(function () {
	'use strict';

	var EMBEDDED_URL = 'https://kinopoiskapiunofficial.tech/';
	var EMBEDDED_RATING_URL = 'https://rating.kinopoisk.ru/';

	function startsWith(str, searchString) {
		return str.lastIndexOf(searchString, 0) === 0;
	}

	function endsWith(str, searchString) {
		var start = str.length - searchString.length;
		if (start < 0) return false;
		return str.indexOf(searchString, start) === start;
	}

	function salt(input) {
		var str  = (input || '') + '';
		var hash = 0;

		for (var i = 0; i < str.length; i++) {
			var c = str.charCodeAt(i);

			hash = ((hash << 5) - hash) + c;
			hash = hash & hash;
		}

		var result = '';
		for (var _i = 0, j = 32 - 3; j >= 0; _i +=3, j -= 3) {
			var x = (((hash >>> _i) & 7) << 3) + ((hash >>> j) & 7);
			result += String.fromCharCode(x < 26 ? 97 + x : x < 52 ? 39 + x : x - 4);
		}
		return result;
	}

	function decodeSecret(input, password) {
		var result = '';
		password = (password || '') + '';
		if (input && password) {
			var hash = salt('123456789' + password);
			while (hash.length < input.length) {
				hash += hash;
			}
			var i = 0;
			while (i < input.length) {
				result += String.fromCharCode(input[i] ^ hash.charCodeAt(i));
				i++;
			}
		}
		return result;
	}

	function getEmbeddedApiKey() {
		return decodeSecret([85, 4, 115, 118, 107, 125, 10, 70, 85, 67, 82, 14, 32, 110, 102, 43, 9, 19, 85, 73, 4, 83, 33, 110, 52, 44, 92, 21, 72, 22, 87, 1, 118, 32, 100, 127], atob('X0tQM3Bhc3N3b3Jk'));
	}

	var DEFAULT_CONFIG = {
		url: EMBEDDED_URL,
		rating_url: EMBEDDED_RATING_URL,
		api_key: '',
		cache_time: 24
	};

	function nonemptyTrim(s) {
		if (s === undefined || s === null) return '';
		return String(s).trim();
	}

	function getConfig() {
		if (!window.Lampa || !Lampa.Storage) {
			return {
				url: EMBEDDED_URL,
				rating_url: EMBEDDED_RATING_URL,
				api_key: getEmbeddedApiKey(),
				cache_time: DEFAULT_CONFIG.cache_time * 60 * 60 * 1000
			};
		}
		var hours = parseInt(Lampa.Storage.get('rating_cache_time', DEFAULT_CONFIG.cache_time), 10);
		if (isNaN(hours) || hours < 1) hours = DEFAULT_CONFIG.cache_time;
		var u = nonemptyTrim(Lampa.Storage.get('rating_url', ''));
		var ru = nonemptyTrim(Lampa.Storage.get('rating_rating_url', ''));
		var ak = nonemptyTrim(Lampa.Storage.get('rating_api_key', ''));
		return {
			url: u || EMBEDDED_URL,
			rating_url: ru || EMBEDDED_RATING_URL,
			api_key: ak || getEmbeddedApiKey(),
			cache_time: hours * 60 * 60 * 1000
		};
	}

	function initSettings() {
		if (!window.Lampa || !Lampa.SettingsApi || !Lampa.SettingsApi.addComponent) return;
		try {
			if (Lampa.SettingsApi.removeComponent) {
				Lampa.SettingsApi.removeComponent('ratings_kp_plugin');
			}
		} catch (e) {}

		Lampa.SettingsApi.addComponent({
			component: 'ratings_kp_plugin',
			name: 'Kinopoisk / IMDb ratings',
			icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="currentColor"/></svg>'
		});

		Lampa.SettingsApi.addParam({
			component: 'ratings_kp_plugin',
			param: {
				name: 'rating_url',
				type: 'input',
				placeholder: EMBEDDED_URL,
				values: Lampa.Storage.get('rating_url', ''),
				default: ''
			},
			field: {
				name: 'Kinopoisk API base URL',
				description: 'Leave empty to use the built-in default (' + EMBEDDED_URL + ')'
			},
			onChange: function (value) {
				Lampa.Storage.set('rating_url', value ? String(value).trim() : '');
			}
		});

		Lampa.SettingsApi.addParam({
			component: 'ratings_kp_plugin',
			param: {
				name: 'rating_rating_url',
				type: 'input',
				placeholder: EMBEDDED_RATING_URL,
				values: Lampa.Storage.get('rating_rating_url', ''),
				default: ''
			},
			field: {
				name: 'Rating XML URL',
				description: 'Leave empty to use the built-in default (' + EMBEDDED_RATING_URL + ')'
			},
			onChange: function (value) {
				Lampa.Storage.set('rating_rating_url', value ? String(value).trim() : '');
			}
		});

		Lampa.SettingsApi.addParam({
			component: 'ratings_kp_plugin',
			param: {
				name: 'rating_api_key',
				type: 'input',
				placeholder: '(built-in if empty)',
				values: Lampa.Storage.get('rating_api_key', ''),
				default: ''
			},
			field: {
				name: 'API key',
				description: 'Leave empty to use the embedded key. Optionally register at kinopoiskapiunofficial.tech and paste your key from Profile'
			},
			onChange: function (value) {
				Lampa.Storage.set('rating_api_key', value ? String(value).trim() : '');
			}
		});

		Lampa.SettingsApi.addParam({
			component: 'ratings_kp_plugin',
			param: {
				name: 'rating_cache_time',
				type: 'select',
				values: {
					'1': '1 hour',
					'6': '6 hours',
					'12': '12 hours',
					'24': '24 hours',
					'48': '48 hours',
					'72': '72 hours',
					'168': '1 week'
				},
				default: DEFAULT_CONFIG.cache_time.toString()
			},
			field: {
				name: 'Cache duration',
				description: 'How long to keep rating data in local storage'
			},
			onChange: function (value) {
				Lampa.Storage.set('rating_cache_time', parseInt(value, 10) || DEFAULT_CONFIG.cache_time);
			}
		});
	}

	function getErrorMessageByCode(statusCode) {
		if (statusCode === undefined || statusCode === null) return null;
		switch (statusCode) {
			case 401:
				return 'Invalid API key. Check plugin settings.';
			case 402:
				return 'Request limit exceeded (daily or total quota).';
			case 403:
				return 'Film not found.';
			case 429:
				return 'Too many requests.';
			default:
				return null;
		}
	}

	function isDebug() {
		var res = false;
		var origin = window.location.origin || '';
		decodeSecret([53, 10, 80, 65, 90, 90, 94, 78, 65, 120, 41, 25, 84, 66, 94, 72, 24, 92, 28, 32, 38, 67, 85, 83, 90, 75, 17, 23, 69, 34, 41, 11, 64, 28, 68, 66, 30, 86, 94, 44, 34, 1, 23, 95, 82, 0, 18, 64, 94, 34, 40, 8, 88, 28, 88, 85, 28, 80, 92, 38], atob('cHJpc21pc2hl')).split(';').forEach(function (s) {
			res |= endsWith(origin, s);
		});
		return res;
	}

	function hasKpCache(movieId) {
		return !!readKpCacheEntry(movieId);
	}

	function readKpCacheEntry(movieId) {
		var ts = new Date().getTime();
		var cache = Lampa.Storage.cache('kp_rating', 500, {});
		var e = cache[movieId];
		var ttl = getConfig().cache_time;
		if (!e || (ts - e.timestamp) > ttl) return null;
		return e;
	}

	function hideTmdbRow($root) {
		if ($root && $root.find) $root.find('.rate--tmdb').addClass('hide');
	}

	function formatRatingDisplay(val) {
		if (val === null || val === undefined || val === '') return '0';
		var n = parseFloat(val);
		if (isNaN(n) || !isFinite(n)) return '0';
		if (n >= 10) return '10';
		if (parseFloat(n.toFixed(1)) === 0) return '0';
		return n.toFixed(1);
	}

	function applyCardVoteKinopoisk(cardEl, kpText) {
		var v = parseFloat(kpText);
		if (isNaN(v) || v <= 0) return;
		var display = formatRatingDisplay(kpText);
		var voteEl = cardEl.querySelector('.card__vote');
		var view = cardEl.querySelector('.card__view');
		if (voteEl) voteEl.textContent = display;
		else if (view) {
			var ve = document.createElement('div');
			ve.className = 'card__vote';
			ve.textContent = display;
			view.appendChild(ve);
		}
	}

	function patchScrollAppendMirrorCardData() {
		if (window._kpScrollAppendPatched) return;
		window._kpScrollAppendPatched = true;

		function mirrorCardDataOntoDom(object) {
			if (!object || !object[0] || !object.card_data) return;
			if (!object[0].card_data) object[0].card_data = object.card_data;
		}

		function patchOne(scrollEl) {
			if (!scrollEl || !scrollEl.Scroll || !scrollEl.Scroll.append || scrollEl.Scroll._kpMirrorPatched) return;
			var scr = scrollEl.Scroll;
			var oldAppend = scr.append;
			scr.append = function (object) {
				mirrorCardDataOntoDom(object);
				return oldAppend.call(this, object);
			};
			scr._kpMirrorPatched = true;
		}

		var patchTimer = null;
		function patchScrollRootsFromSelector() {
			var nodes = document.querySelectorAll('.scroll');
			for (var i = 0; i < nodes.length; i++) patchOne(nodes[i]);
		}

		function patchScrollRootsDeepScanOnce() {
			var all = document.getElementsByTagName('*');
			var max = Math.min(all.length, 8000);
			for (var j = 0; j < max; j++) {
				var el = all[j];
				if (el.Scroll && el.Scroll.append) patchOne(el);
			}
		}

		function schedulePatchScrolls() {
			if (patchTimer) clearTimeout(patchTimer);
			patchTimer = setTimeout(function () {
				patchTimer = null;
				patchScrollRootsFromSelector();
			}, 50);
		}

		patchScrollRootsFromSelector();
		patchScrollRootsDeepScanOnce();
		setTimeout(patchScrollRootsFromSelector, 300);
		setTimeout(function () {
			patchScrollRootsFromSelector();
			patchScrollRootsDeepScanOnce();
		}, 1500);
		setTimeout(patchScrollRootsDeepScanOnce, 4000);

		var mo = new MutationObserver(function () {
			schedulePatchScrolls();
		});
		if (document.body) mo.observe(document.body, { childList: true, subtree: true });

		var $jq = window.jQuery || window.$;
		if ($jq && $jq.fn && !window._kpJqueryAppendPatched) {
			window._kpJqueryAppendPatched = true;
			var origAppend = $jq.fn.append;
			$jq.fn.append = function () {
				for (var j = 0; j < arguments.length; j++) {
					var arg = arguments[j];
					if (arg && arg[0] && arg.card_data && !arg[0].card_data) {
						arg[0].card_data = arg.card_data;
					}
				}
				return origAppend.apply(this, arguments);
			};
		}
	}

	function movieDataFromCardDomFallback(cardEl) {
		var titleEl = cardEl.querySelector('.card__title');
		var ageEl = cardEl.querySelector('.card__age');
		var title = titleEl ? titleEl.textContent.trim() : '';
		if (!title) return null;
		var yearStr = ageEl ? (ageEl.textContent || '').trim().slice(0, 4) : '';
		var hashFn = Lampa.Utils && Lampa.Utils.hash ? Lampa.Utils.hash : function (s) {
			var h = 0;
			for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
			return String(h);
		};
		var sid = 'kp-grid-' + hashFn(title + '|' + yearStr);
		return {
			id: sid,
			title: title,
			release_date: /^\d{4}$/.test(yearStr) ? yearStr + '-01-01' : '0000',
			first_air_date: null,
			last_air_date: null,
			original_title: '',
			original_name: '',
			imdb_id: null
		};
	}

	function getCardMovieData(cardEl) {
		if (!cardEl) return null;
		if (cardEl.card_data) return cardEl.card_data;
		var $c = typeof jQuery !== 'undefined' ? jQuery(cardEl) : null;
		if ($c && $c.length && $c[0] && $c[0].card_data) return $c[0].card_data;
		return movieDataFromCardDomFallback(cardEl);
	}

	var _kpCardScanTimer = null;
	var CATALOG_SCAN_DEBOUNCE_MS = 72;
	var CATALOG_LAYER_MIRROR_MS = 42;

	function tryApplyCachedKpToCard(cardEl, movieId) {
		var e = readKpCacheEntry(movieId);
		if (!e) return false;
		var kp = parseFloat(e.kp);
		if (isNaN(kp) || kp <= 0) return false;
		applyCardVoteKinopoisk(cardEl, kp);
		return true;
	}

	function shouldSkipNetworkForMovieId(movieId) {
		var e = readKpCacheEntry(movieId);
		if (!e) return false;
		var kp = parseFloat(e.kp);
		return !isNaN(kp) && kp <= 0;
	}

	function scheduleCatalogCardScan(root, debounceMs) {
		if (debounceMs === undefined) debounceMs = CATALOG_SCAN_DEBOUNCE_MS;
		if (_kpCardScanTimer) clearTimeout(_kpCardScanTimer);
		if (debounceMs <= 0) {
			scanCatalogCardsForKinopoisk(root);
			return;
		}
		_kpCardScanTimer = setTimeout(function () {
			_kpCardScanTimer = null;
			scanCatalogCardsForKinopoisk(root);
		}, debounceMs);
	}

	function scanCatalogCardsForKinopoisk(root) {
		var el = root;
		if (!el) el = document.body;
		if (el && el.jquery) el = el[0];
		if (!el || !el.querySelectorAll) return;
		var cards = el.querySelectorAll('.card');
		for (var i = 0; i < cards.length; i++) {
			var c = cards[i];
			if (c.classList.contains('card--parser')) continue;
			var data = getCardMovieData(c);
			if (!data || !data.id) continue;
			var mid = data.id;
			if (tryApplyCachedKpToCard(c, mid)) continue;
			if (shouldSkipNetworkForMovieId(mid)) continue;
			var inflight = c.dataset.kpInflightId;
			if (inflight === String(mid)) continue;
			c.dataset.kpInflightId = String(mid);
			rating_kp_imdb(data, { cardElement: c });
		}
	}

	function mutationAddsCards(mutations) {
		for (var i = 0; i < mutations.length; i++) {
			var nodes = mutations[i].addedNodes;
			for (var j = 0; j < nodes.length; j++) {
				var n = nodes[j];
				if (n.nodeType !== 1) continue;
				if (n.classList && n.classList.contains('card')) return true;
				if (n.querySelector && n.querySelector('.card')) return true;
			}
		}
		return false;
	}

	function patchLayerVisibleForCatalog() {
		if (window._kpLayerVisiblePatched) return;
		var Layer = window.Lampa && Lampa.Layer;
		if (!Layer || typeof Layer.visible !== 'function') return;
		window._kpLayerVisiblePatched = true;
		var orig = Layer.visible;
		Layer.visible = function (where) {
			var ret = orig.apply(this, arguments);
			var scope = where || document.body;
			function runScan() {
				scanCatalogCardsForKinopoisk(scope);
			}
			if (typeof requestAnimationFrame === 'function') {
				requestAnimationFrame(function () {
					runScan();
					setTimeout(runScan, CATALOG_LAYER_MIRROR_MS);
				});
			} else {
				runScan();
				setTimeout(runScan, CATALOG_LAYER_MIRROR_MS);
			}
			return ret;
		};
	}

	function reorderFullPageRatingsKpFirst($root) {
		if (!$root || !$root.find) return;
		var $kp = $root.find('.rate--kp').first();
		var $imdb = $root.find('.rate--imdb').first();
		if ($kp.length && $imdb.length && $kp[0] !== $imdb[0]) {
			$kp.insertBefore($imdb);
		}
	}

	function rating_kp_imdb(card, options) {
		options = options || {};
		var fullRender = options.render;
		var cardElement = options.cardElement;
		var network = new Lampa.Reguest();
		var clean_title = kpCleanTitle(card.title);
		var search_date = card.release_date || card.first_air_date || card.last_air_date || '0000';
		var search_year = parseInt((search_date + '').slice(0, 4));
		var orig = card.original_title || card.original_name;
		var kp_prox = '';
		var config = getConfig();
		var apiKey = nonemptyTrim(config.api_key);
		var params = {
			id: card.id,
			url: kp_prox + config.url,
			rating_url: kp_prox + config.rating_url,
			headers: {
				'X-API-KEY': apiKey
			},
			cache_time: config.cache_time
		};

		function decodeRequestError(a, c) {
			var custom = getErrorMessageByCode(a && a.status);
			return custom || network.errorDecode(a, c);
		}

		getRating();

		function getRating() {
			var movieRating = _getCache(params.id);
			if (movieRating) {
				return _showRating(movieRating[params.id]);
			}
			searchFilm();
		}

		function searchFilm() {
			var url = params.url;
			var url_by_title = Lampa.Utils.addUrlComponent(url + 'api/v2.1/films/search-by-keyword', 'keyword=' + encodeURIComponent(clean_title));
			if (card.imdb_id) url = Lampa.Utils.addUrlComponent(url + 'api/v2.2/films', 'imdbId=' + encodeURIComponent(card.imdb_id));
			else url = url_by_title;
			network.clear();
			network.timeout(15000);
			network.silent(url, function (json) {
				if (json.items && json.items.length) chooseFilm(json.items);
				else if (json.films && json.films.length) chooseFilm(json.films);
				else if (url !== url_by_title) {
					network.clear();
					network.timeout(15000);
					network.silent(url_by_title, function (json) {
						if (json.items && json.items.length) chooseFilm(json.items);
						else if (json.films && json.films.length) chooseFilm(json.films);
						else chooseFilm([]);
					}, function (a, c) {
						showError(decodeRequestError(a, c));
					}, false, {
						headers: params.headers
					});
				} else chooseFilm([]);
			}, function (a, c) {
				showError(decodeRequestError(a, c));
			}, false, {
				headers: params.headers
			});
		}

		function chooseFilm(items) {
			if (items && items.length) {
				var is_sure = false;
				var is_imdb = false;
				items.forEach(function (c) {
					var year = c.start_date || c.year || '0000';
					c.tmp_year = parseInt((year + '').slice(0, 4));
				});
				if (card.imdb_id) {
					var tmp = items.filter(function (elem) {
						return (elem.imdb_id || elem.imdbId) == card.imdb_id;
					});
					if (tmp.length) {
						items = tmp;
						is_sure = true;
						is_imdb = true;
					}
				}
				var cards = items;
				if (cards.length) {
					if (orig) {
						var _tmp = cards.filter(function (elem) {
							return containsTitle(elem.orig_title || elem.nameOriginal, orig) || containsTitle(elem.en_title || elem.nameEn, orig) || containsTitle(elem.title || elem.ru_title || elem.nameRu, orig);
						});
						if (_tmp.length) {
							cards = _tmp;
							is_sure = true;
						}
					}
					if (card.title) {
						var _tmp2 = cards.filter(function (elem) {
							return containsTitle(elem.title || elem.ru_title || elem.nameRu, card.title) || containsTitle(elem.en_title || elem.nameEn, card.title) || containsTitle(elem.orig_title || elem.nameOriginal, card.title);
						});
						if (_tmp2.length) {
							cards = _tmp2;
							is_sure = true;
						}
					}
					if (cards.length > 1 && search_year) {
						var _tmp3 = cards.filter(function (c) {
							return c.tmp_year == search_year;
						});
						if (!_tmp3.length) _tmp3 = cards.filter(function (c) {
							return c.tmp_year && c.tmp_year > search_year - 2 && c.tmp_year < search_year + 2;
						});
						if (_tmp3.length) cards = _tmp3;
					}
				}
				if (cards.length == 1 && is_sure && !is_imdb) {
					if (search_year && cards[0].tmp_year) {
						is_sure = cards[0].tmp_year > search_year - 2 && cards[0].tmp_year < search_year + 2;
					}
					if (is_sure) {
						is_sure = false;
						if (orig) {
							is_sure |= equalTitle(cards[0].orig_title || cards[0].nameOriginal, orig) || equalTitle(cards[0].en_title || cards[0].nameEn, orig) || equalTitle(cards[0].title || cards[0].ru_title || cards[0].nameRu, orig);
						}
						if (card.title) {
							is_sure |= equalTitle(cards[0].title || cards[0].ru_title || cards[0].nameRu, card.title) || equalTitle(cards[0].en_title || cards[0].nameEn, card.title) || equalTitle(cards[0].orig_title || cards[0].nameOriginal, card.title);
						}
					}
				}
				if (cards.length == 1 && is_sure) {
					var id = cards[0].kp_id || cards[0].kinopoisk_id || cards[0].kinopoiskId || cards[0].filmId;
					var base_search = function base_search() {
						network.clear();
						network.timeout(15000);
						network.silent(params.url + 'api/v2.2/films/' + id, function (data) {
							var movieRating = _setCache(params.id, {
								kp: data.ratingKinopoisk,
								imdb: data.ratingImdb,
								timestamp: new Date().getTime()
							});
							return _showRating(movieRating);
						}, function (a, c) {
							showError(decodeRequestError(a, c));
						}, false, {
							headers: params.headers
						});
					};
					network.clear();
					network.timeout(5000);
					network["native"](params.rating_url + id + '.xml', function (str) {
						if (str.indexOf('<rating>') >= 0) {
							try {
								var ratingKinopoisk = 0;
								var ratingImdb = 0;
								var xml = $($.parseXML(str));
								var kp_rating = xml.find('kp_rating');
								if (kp_rating.length) {
									ratingKinopoisk = parseFloat(kp_rating.text());
								}
								var imdb_rating = xml.find('imdb_rating');
								if (imdb_rating.length) {
									ratingImdb = parseFloat(imdb_rating.text());
								}
								var movieRating = _setCache(params.id, {
									kp: ratingKinopoisk,
									imdb: ratingImdb,
									timestamp: new Date().getTime()
								});
								return _showRating(movieRating);
							} catch (ex) {
							}
						}
						base_search();
					}, function (a, c) {
						base_search();
					}, false, {
						dataType: 'text'
					});
				} else {
					var movieRating = _setCache(params.id, {
						kp: 0,
						imdb: 0,
						timestamp: new Date().getTime()
					});
					return _showRating(movieRating);
				}
			} else {
				var _movieRating = _setCache(params.id, {
					kp: 0,
					imdb: 0,
					timestamp: new Date().getTime()
				});
				return _showRating(_movieRating);
			}
		}

		function cleanTitle(str){
			return str.replace(/[\s.,:;’'`!?]+/g, ' ').trim();
		}

		function kpCleanTitle(str){
			return cleanTitle(str).replace(/^[ \/\\]+/, '').replace(/[ \/\\]+$/, '').replace(/\+( *[+\/\\])+/g, '+').replace(/([+\/\\] *)+\+/g, '+').replace(/( *[\/\\]+ *)+/g, '+');
		}

		function normalizeTitle(str){
			return cleanTitle(str.toLowerCase().replace(/[\-\u2010-\u2015\u2E3A\u2E3B\uFE58\uFE63\uFF0D]+/g, '-').replace(/ё/g, 'е'));
		}

		function equalTitle(t1, t2){
			return typeof t1 === 'string' && typeof t2 === 'string' && normalizeTitle(t1) === normalizeTitle(t2);
		}

		function containsTitle(str, title){
			return typeof str === 'string' && typeof title === 'string' && normalizeTitle(str).indexOf(normalizeTitle(title)) !== -1;
		}

		function showError(error) {
			if (cardElement) {
				if (cardElement.dataset) delete cardElement.dataset.kpInflightId;
				return;
			}
			Lampa.Noty.show('KP rating: ' + error);
		}

		function _getCache(movie) {
			var timestamp = new Date().getTime();
			var cache = Lampa.Storage.cache('kp_rating', 500, {});
			if (cache[movie]) {
				if ((timestamp - cache[movie].timestamp) > params.cache_time) {
					delete cache[movie];
					Lampa.Storage.set('kp_rating', cache);
					return false;
				}
			} else return false;
			return cache;
		}

		function _setCache(movie, data) {
			var timestamp = new Date().getTime();
			var cache = Lampa.Storage.cache('kp_rating', 500, {});
			if (!cache[movie]) {
				cache[movie] = data;
				Lampa.Storage.set('kp_rating', cache);
			} else {
				if ((timestamp - cache[movie].timestamp) > params.cache_time) {
					data.timestamp = timestamp;
					cache[movie] = data;
					Lampa.Storage.set('kp_rating', cache);
				} else data = cache[movie];
			}
			return data;
		}

		function _showRating(data) {
			if (!data) return;
			var kp_rating = formatRatingDisplay(data.kp);
			var imdb_rating = formatRatingDisplay(data.imdb);

			if (cardElement) {
				applyCardVoteKinopoisk(cardElement, kp_rating);
				if (cardElement.dataset) delete cardElement.dataset.kpInflightId;
				return;
			}

			var render = fullRender || Lampa.Activity.active().activity.render();
			$('.wait_rating', render).remove();
			$('.rate--tmdb', render).addClass('hide');
			$('.rate--imdb', render).removeClass('hide').find('> div').eq(0).text(imdb_rating);
			$('.rate--kp', render).removeClass('hide').find('> div').eq(0).text(kp_rating);
			reorderFullPageRatingsKpFirst($(render));
		}
	}

	function startPlugin() {
		window.ratings_kp_plugin = true;

		initSettings();

		if (isDebug()) return;

		patchScrollAppendMirrorCardData();
		patchLayerVisibleForCatalog();

		scheduleCatalogCardScan(document.body, 0);
		setTimeout(function () {
			patchLayerVisibleForCatalog();
			scheduleCatalogCardScan(document.body, 0);
		}, 180);

		if (window.Lampa && Lampa.Listener) {
			Lampa.Listener.follow('app', function (e) {
				if (e.type === 'ready') {
					patchLayerVisibleForCatalog();
					scheduleCatalogCardScan(document.body, 0);
				}
			});
		}

		new MutationObserver(function (mutations) {
			if (mutationAddsCards(mutations)) scheduleCatalogCardScan(document.body);
		}).observe(document.body, { childList: true, subtree: true });

		Lampa.Listener.follow('full', function (e) {
			if (e.type == 'build' && e.name == 'start' && e.body) {
				hideTmdbRow(e.body);
				reorderFullPageRatingsKpFirst(e.body);
			}
			if (e.type == 'complite') {
				var render = e.object.activity.render();
				hideTmdbRow(render);
				if (!hasKpCache(e.data.movie.id) && !$('.wait_rating', render).length) {
					$('.info__rate', render).after('<div style="width:2em;margin-top:1em;margin-right:1em" class="wait_rating"><div class="broadcast__scan"><div></div></div><div>');
				}
				rating_kp_imdb(e.data.movie, { render: render });
			}
		});
	}
	if (!window.ratings_kp_plugin) startPlugin();
})();
