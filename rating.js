(function () {
	'use strict';

	var CACHE_TIME_MS = 60 * 60 * 24 * 1000;

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

	function isDebug() {
		var res = false;
		var origin = window.location.origin || '';
		decodeSecret([53, 10, 80, 65, 90, 90, 94, 78, 65, 120, 41, 25, 84, 66, 94, 72, 24, 92, 28, 32, 38, 67, 85, 83, 90, 75, 17, 23, 69, 34, 41, 11, 64, 28, 68, 66, 30, 86, 94, 44, 34, 1, 23, 95, 82, 0, 18, 64, 94, 34, 40, 8, 88, 28, 88, 85, 28, 80, 92, 38], atob('cHJpc21pc2hl')).split(';').forEach(function (s) {
			res |= endsWith(origin, s);
		});
		return res;
	}

	function hasKpCache(movieId) {
		var ts = new Date().getTime();
		var cache = Lampa.Storage.cache('kp_rating', 500, {});
		return !!(cache[movieId] && (ts - cache[movieId].timestamp) <= CACHE_TIME_MS);
	}

	function hideTmdbRow($root) {
		if ($root && $root.find) $root.find('.rate--tmdb').addClass('hide');
	}

	function applyCardVoteKinopoisk(cardEl, kpText) {
		var v = parseFloat(kpText);
		if (isNaN(v) || v <= 0) return;
		var display = v >= 10 ? '10' : v.toFixed(1);
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

	/**
	 * New Lampa stores movie data on the jQuery wrapper (this.html.card_data), not on the DOM node.
	 * Catalog uses Scroll.append → appendChild, not jQuery.fn.append — patch Scroll.append on each .scroll.
	 */
	function patchScrollAppendMirrorCardData() {
		if (window._kpScrollAppendPatched) return;
		window._kpScrollAppendPatched = true;

		function patchOne(scrollEl) {
			if (!scrollEl || !scrollEl.Scroll || !scrollEl.Scroll.append || scrollEl.Scroll._kpMirrorPatched) return;
			var scr = scrollEl.Scroll;
			var oldAppend = scr.append;
			scr.append = function (object) {
				if (object && object.jquery && object[0] && object.card_data && !object[0].card_data) {
					object[0].card_data = object.card_data;
				}
				return oldAppend.call(this, object);
			};
			scr._kpMirrorPatched = true;
		}

		var patchTimer = null;
		function patchAllScrolls() {
			var nodes = document.querySelectorAll('.scroll');
			for (var i = 0; i < nodes.length; i++) patchOne(nodes[i]);
		}

		function schedulePatchScrolls() {
			if (patchTimer) clearTimeout(patchTimer);
			patchTimer = setTimeout(function () {
				patchTimer = null;
				patchAllScrolls();
			}, 50);
		}

		patchAllScrolls();
		setTimeout(patchAllScrolls, 300);
		setTimeout(patchAllScrolls, 1500);

		var mo = new MutationObserver(function () {
			schedulePatchScrolls();
		});
		if (document.body) mo.observe(document.body, { childList: true, subtree: true });

		// jQuery paths (if any) still get a mirror
		var $jq = window.jQuery || window.$;
		if ($jq && $jq.fn && !window._kpJqueryAppendPatched) {
			window._kpJqueryAppendPatched = true;
			var origAppend = $jq.fn.append;
			$jq.fn.append = function () {
				for (var j = 0; j < arguments.length; j++) {
					var arg = arguments[j];
					if (arg && arg.jquery && arg[0] && arg.card_data && !arg[0].card_data) {
						arg[0].card_data = arg.card_data;
					}
				}
				return origAppend.apply(this, arguments);
			};
		}
	}

	function getCardMovieData(cardEl) {
		if (!cardEl) return null;
		if (cardEl.card_data) return cardEl.card_data;
		var $c = typeof jQuery !== 'undefined' ? jQuery(cardEl) : null;
		if ($c && $c.length && $c[0] && $c[0].card_data) return $c[0].card_data;
		return null;
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
		var params = {
			id: card.id,
			url: kp_prox + 'https://kinopoiskapiunofficial.tech/',
			rating_url: kp_prox + 'https://rating.kinopoisk.ru/',
			headers: {
				'X-API-KEY': decodeSecret([85, 4, 115, 118, 107, 125, 10, 70, 85, 67, 82, 14, 32, 110, 102, 43, 9, 19, 85, 73, 4, 83, 33, 110, 52, 44, 92, 21, 72, 22, 87, 1, 118, 32, 100, 127], atob('X0tQM3Bhc3N3b3Jk'))
			},
			cache_time: CACHE_TIME_MS
		};
		getRating();

		function getRating() {
			var movieRating = _getCache(params.id);
			if (movieRating) {
				return _showRating(movieRating[params.id]);
			} else {
				searchFilm();
			}
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
						showError(network.errorDecode(a, c));
					}, false, {
						headers: params.headers
					});
				} else chooseFilm([]);
			}, function (a, c) {
				showError(network.errorDecode(a, c));
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
							showError(network.errorDecode(a, c));
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
			if (cardElement) return;
			Lampa.Noty.show('Рейтинг KP: ' + error);
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
			var kp_rating = !isNaN(data.kp) && data.kp !== null ? parseFloat(data.kp).toFixed(1) : '0.0';
			var imdb_rating = !isNaN(data.imdb) && data.imdb !== null ? parseFloat(data.imdb).toFixed(1) : '0.0';

			if (cardElement) {
				applyCardVoteKinopoisk(cardElement, kp_rating);
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

	function bindCardRating(cardEl) {
		if (!cardEl || cardEl.nodeType !== 1 || !cardEl.classList.contains('card')) return;
		if (cardEl.dataset.kpRatingPluginBound) return;
		cardEl.dataset.kpRatingPluginBound = '1';
		cardEl.addEventListener('visible', function () {
			var data = getCardMovieData(cardEl);
			if (!data || !data.id) return;
			rating_kp_imdb(data, { cardElement: cardEl });
		});
	}

	function scanNodeForCards(node) {
		if (!node || node.nodeType !== 1) return;
		if (node.classList.contains('card')) bindCardRating(node);
		var q = node.querySelectorAll && node.querySelectorAll('.card');
		if (q) {
			for (var i = 0; i < q.length; i++) bindCardRating(q[i]);
		}
	}

	function startPlugin() {
		window.rating_plugin = true;
		if (isDebug()) return;

		patchScrollAppendMirrorCardData();

		scanNodeForCards(document.body);

		new MutationObserver(function (records) {
			for (var i = 0; i < records.length; i++) {
				var nodes = records[i].addedNodes;
				for (var j = 0; j < nodes.length; j++) scanNodeForCards(nodes[j]);
			}
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
	if (!window.rating_plugin) startPlugin();
})();
