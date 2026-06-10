(function () {
    'use strict';

    if (window.my_interface_plugin) return;
    window.my_interface_plugin = true;

    /* Block the old standalone plugins if they load after this one */
    window.rating_plugin = true;
    window.logoplugin = true;

    var FAVS_STORAGE_KEY = 'my_interface_favs';
    var FAV_CATEGORIES = ['like', 'wath', 'book', 'history', 'look', 'viewed', 'scheduled', 'continued', 'thrown'];

    /* ================================================================
     * 0. Language strings (en + ru)
     * ================================================================ */

    Lampa.Lang.add({
        mi_settings_name: { en: 'My Interface', ru: 'Мой интерфейс' },
        mi_settings_descr: { en: 'Ratings, logos, header, buttons and favorites', ru: 'Рейтинги, логотипы, шапка, кнопки и избранное' },

        mi_rating_name: { en: 'KP / IMDB ratings', ru: 'Рейтинги КП / IMDB' },
        mi_rating_descr: { en: 'Show Kinopoisk and IMDB ratings on posters and the film page', ru: 'Показывать рейтинги Кинопоиска и IMDB на постерах и в карточке' },
        mi_logo_name: { en: 'Logo instead of title', ru: 'Логотип вместо названия' },
        mi_logo_descr: { en: 'Show the movie logo image instead of the text title', ru: 'Отображать логотип фильма вместо текстового названия' },
        mi_allbtn_name: { en: 'Show all buttons', ru: 'Показывать все кнопки' },
        mi_allbtn_descr: { en: 'Show every source button on the film page instead of the sources menu', ru: 'Показывать все кнопки источников в карточке вместо меню источников' },

        mi_head_button: { en: 'Header elements', ru: 'Элементы шапки' },
        mi_head_descr: { en: 'Show or hide icons in the header', ru: 'Показать или скрыть иконки в шапке' },
        mi_head_title: { en: 'Display in header', ru: 'Отображать в шапке' },
        mi_head_search: { en: 'Search', ru: 'Поиск' },
        mi_head_settings: { en: 'Settings', ru: 'Настройки' },
        mi_head_premium: { en: 'Premium', ru: 'Премиум' },
        mi_head_profile: { en: 'Profile', ru: 'Профиль' },
        mi_head_feed: { en: 'Feed', ru: 'Новости' },
        mi_head_notice: { en: 'Notifications', ru: 'Уведомления' },
        mi_head_broadcast: { en: 'Broadcast', ru: 'Вещание' },
        mi_head_fullscreen: { en: 'Fullscreen mode', ru: 'Полноэкранный режим' },
        mi_head_reload: { en: 'Page reload', ru: 'Обновление страницы' },
        mi_head_blackfriday: { en: 'Black Friday', ru: 'Черная пятница' },
        mi_head_split: { en: 'Divider', ru: 'Разделитель' },
        mi_head_time: { en: 'Time', ru: 'Время' },

        mi_favs_defaults: { en: 'Favorites', ru: 'Избранное' },
        mi_favs_defaults_descr: { en: 'Hide or rename the bookmark categories', ru: 'Скрыть или переименовать категории закладок' },
        mi_favs_name: { en: 'Name', ru: 'Название' },
        mi_favs_rename: { en: 'Rename', ru: 'Переименовать' },
        mi_favs_hidden: { en: 'Hidden', ru: 'Скрыт' },
        mi_favs_visible: { en: 'Visible', ru: 'Отображается' },
        mi_favs_hide: { en: 'Hide', ru: 'Скрыть' },
        mi_favs_show: { en: 'Show', ru: 'Показывать' },
        mi_favs_reset_name: { en: 'Reset name', ru: 'Сбросить название' }
    });

    /* ================================================================
     * Helpers
     * ================================================================ */

    function miEnabled(key) {
        return Lampa.Storage.get(key, true) !== false;
    }

    function isArr(x) {
        return Object.prototype.toString.call(x) === '[object Array]';
    }

    function cloneObj(x) {
        if (Lampa.Arrays && Lampa.Arrays.clone) return Lampa.Arrays.clone(x);
        return JSON.parse(JSON.stringify(x));
    }

    function translate(key) {
        return Lampa.Lang.translate(key);
    }

    /* ================================================================
     * 1. Settings root - "My Interface" section
     * ================================================================ */

    var HEAD_ELEMENTS = {
        'head_filter_show_search': { lang: 'mi_head_search', element: '.open--search' },
        'head_filter_show_settings': { lang: 'mi_head_settings', element: '.open--settings' },
        'head_filter_show_premium': { lang: 'mi_head_premium', element: '.open--premium' },
        'head_filter_show_profile': { lang: 'mi_head_profile', element: '.open--profile' },
        'head_filter_show_feed': { lang: 'mi_head_feed', element: '.open--feed' },
        'head_filter_show_notice': { lang: 'mi_head_notice', element: '.notice--icon' },
        'head_filter_show_broadcast': { lang: 'mi_head_broadcast', element: '.open--broadcast' },
        'head_filter_show_fullscreen': { lang: 'mi_head_fullscreen', element: '.full-screen' },
        'head_filter_show_reload': { lang: 'mi_head_reload', element: '.m-reload-screen' },
        'head_filter_show_blackfriday': { lang: 'mi_head_blackfriday', element: '.black-friday__button' },
        'head_filter_show_split': { lang: 'mi_head_split', element: '.head__split' },
        'head_filter_show_time': { lang: 'mi_head_time', element: '.head__time' }
    };

    function initSettings() {
        Lampa.SettingsApi.addComponent({
            component: 'my_interface',
            after: 'interface',
            name: translate('mi_settings_name'),
            icon: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
                '<circle cx="16" cy="6" r="2" stroke="currentColor" stroke-width="2"/>' +
                '<circle cx="8" cy="12" r="2" stroke="currentColor" stroke-width="2"/>' +
                '<circle cx="16" cy="18" r="2" stroke="currentColor" stroke-width="2"/>' +
                '</svg>'
        });

        Lampa.SettingsApi.addParam({
            component: 'my_interface',
            param: { name: 'mi_rating', type: 'trigger', default: true },
            field: { name: translate('mi_rating_name'), description: translate('mi_rating_descr') }
        });

        Lampa.SettingsApi.addParam({
            component: 'my_interface',
            param: { name: 'mi_logo', type: 'trigger', default: true },
            field: { name: translate('mi_logo_name'), description: translate('mi_logo_descr') }
        });

        Lampa.SettingsApi.addParam({
            component: 'my_interface',
            param: { name: 'mi_all_buttons', type: 'trigger', default: true },
            field: { name: translate('mi_allbtn_name'), description: translate('mi_allbtn_descr') }
        });

        /* --- Header sub-screen --- */

        Lampa.Template.add('settings_my_interface_head', '<div></div>');

        Lampa.SettingsApi.addParam({
            component: 'my_interface',
            param: { type: 'button' },
            field: { name: translate('mi_head_button'), description: translate('mi_head_descr') },
            onChange: function () {
                Lampa.Settings.create('my_interface_head', {
                    onBack: function () {
                        Lampa.Settings.create('my_interface');
                    }
                });
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'my_interface_head',
            param: { type: 'title' },
            field: { name: translate('mi_head_title') }
        });

        Object.keys(HEAD_ELEMENTS).forEach(function (key) {
            Lampa.SettingsApi.addParam({
                component: 'my_interface_head',
                param: { name: key, type: 'trigger', default: true },
                field: { name: translate(HEAD_ELEMENTS[key].lang) }
            });
        });

        /* --- Favorites (handlers provided by MyFavorites) --- */

        Lampa.SettingsApi.addParam({
            component: 'my_interface',
            param: { type: 'button' },
            field: { name: translate('mi_favs_defaults'), description: translate('mi_favs_defaults_descr') },
            onChange: function () {
                MyFavorites.openDefaults();
            }
        });
    }

    /* ================================================================
     * 2. F1 - KP / IMDB ratings (embedded rating.js)
     *    Source: exampls/rating.js, gated on the mi_rating trigger.
     * ================================================================ */

    var CACHE_TIME_MS = 60 * 60 * 24 * 1000;

    var KP_RATING_XML_BASE_URL = 'https://rating.kinopoisk.ru/';
    var KP_API_BASE_URL = 'https://kinopoiskapiunofficial.tech/';
    var KP_API_PATH_SEARCH_BY_KEYWORD = 'api/v2.1/films/search-by-keyword';
    var KP_API_PATH_FILMS_V22 = 'api/v2.2/films';

    function salt(input) {
        var str = (input || '') + '';
        var hash = 0;

        for (var i = 0; i < str.length; i++) {
            var c = str.charCodeAt(i);

            hash = ((hash << 5) - hash) + c;
            hash = hash | 0;
        }

        var result = '';
        for (var _i = 0, j = 32 - 3; j >= 0; _i += 3, j -= 3) {
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

    var KP_API_KEY = decodeSecret([85, 4, 115, 118, 107, 125, 10, 70, 85, 67, 82, 14, 32, 110, 102, 43, 9, 19, 85, 73, 4, 83, 33, 110, 52, 44, 92, 21, 72, 22, 87, 1, 118, 32, 100, 127], atob('X0tQM3Bhc3N3b3Jk'));

    /* Note: the original rating.js had an isDebug() kill-switch that
       silently disabled the plugin on several mirror origins
       (prisma.ws, lampishe.cc, lampa.walsy.synology.me, bylampa.online).
       Removed - it broke ratings on devices that load Lampa from one
       of those mirrors. */

    function hasKpCache(movieId) {
        return !!readKpCacheEntry(movieId);
    }

    function readKpCacheEntry(movieId, cacheMap) {
        var ts = new Date().getTime();
        var cache = cacheMap || Lampa.Storage.cache('kp_rating', 500, {});
        var e = cache[movieId];
        if (!e || (ts - e.timestamp) > CACHE_TIME_MS) return null;
        return e;
    }

    function getCatalogScanRoot() {
        var lv = document.querySelector('.layer--visible');
        if (lv && lv.querySelectorAll) return lv;
        return document.body;
    }

    function tmdbVoteAverage(card) {
        if (!card) return NaN;
        var v = card.vote_average;
        if (v === undefined || v === null || v === '') v = card.vote;
        if (v === undefined || v === null || v === '') return NaN;
        var n = parseFloat(v);
        return isNaN(n) ? NaN : n;
    }

    function hasPositiveRating(val) {
        var n = parseFloat(val);
        return !isNaN(n) && n > 0;
    }

    /**
     * Poster / single-badge: Kinopoisk -> IMDb -> TMDB (vote_average).
     * Returns formatted string or null if none.
     */
    function pickPosterRating(data, card) {
        if (data && hasPositiveRating(data.kp)) return formatRatingDisplay(data.kp);
        if (data && hasPositiveRating(data.imdb)) return formatRatingDisplay(data.imdb);
        var t = tmdbVoteAverage(card);
        if (t > 0) return formatRatingDisplay(t);
        return null;
    }

    function formatRatingDisplay(val) {
        if (val === null || val === undefined || val === '') return '0';
        var n = parseFloat(val);
        if (isNaN(n) || !isFinite(n)) return '0';
        if (n >= 10) return '10';
        if (parseFloat(n.toFixed(1)) === 0) return '0';
        return n.toFixed(1);
    }

    function setCardVoteText(cardEl, display) {
        if (!cardEl || !display) return;
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

    function applyCardPosterRating(cardEl, data, cardMovieData) {
        var display = pickPosterRating(data, cardMovieData || getCardMovieData(cardEl));
        if (!display) return;
        setCardVoteText(cardEl, display);
    }

    /**
     * New Lampa stores movie data on the jQuery wrapper (this.html.card_data), not on the DOM node.
     * Catalog uses Scroll.append -> appendChild, not jQuery.fn.append - patch Scroll.append on each .scroll.
     */
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
                // Do not rely on object.jquery - Zepto/minified builds may omit it; jQuery-like has [0] + card_data
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

        // jQuery paths (if any) still get a mirror
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

    /**
     * Lampa fires the custom "visible" event only on .layer--visible nodes (see core/layer.js), not on .card.
     * Catalog cards therefore never received our listener - we drive KP from periodic scans instead.
     */
    var _kpCardScanTimer = null;
    var CATALOG_SCAN_DEBOUNCE_MS = 72;
    var CATALOG_LAYER_MIRROR_MS = 42;

    function tryApplyCachedRatingToCard(cardEl, movieId, cardData, cacheMap) {
        var e = readKpCacheEntry(movieId, cacheMap);
        if (!e) return false;
        applyCardPosterRating(cardEl, e, cardData || getCardMovieData(cardEl));
        return true;
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
        if (!miEnabled('mi_rating')) return;
        var el = root;
        if (!el) el = document.body;
        if (el && el.jquery) el = el[0];
        if (!el || !el.querySelectorAll) return;
        var kpCache = Lampa.Storage.cache('kp_rating', 500, {});
        var cards = el.querySelectorAll('.card');
        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            if (c.classList.contains('card--parser')) continue;
            var data = getCardMovieData(c);
            if (!data || !data.id) continue;
            var mid = data.id;
            if (tryApplyCachedRatingToCard(c, mid, data, kpCache)) continue;
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
            var scope = where || getCatalogScanRoot();
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
        var kpRatingCacheMap = Lampa.Storage.cache('kp_rating', 500, {});
        var params = {
            id: card.id,
            url: kp_prox + KP_API_BASE_URL,
            rating_url: kp_prox + KP_RATING_XML_BASE_URL,
            headers: {
                'X-API-KEY': KP_API_KEY
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
            var url_by_title = Lampa.Utils.addUrlComponent(url + KP_API_PATH_SEARCH_BY_KEYWORD, 'keyword=' + encodeURIComponent(clean_title));
            if (card.imdb_id) url = Lampa.Utils.addUrlComponent(url + KP_API_PATH_FILMS_V22, 'imdbId=' + encodeURIComponent(card.imdb_id));
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
                var normOrig = orig ? normalizeTitle(orig) : '';
                var normCardTitle = card.title ? normalizeTitle(card.title) : '';
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
                    if (normOrig) {
                        var _tmp = cards.filter(function (elem) {
                            return titleFieldContainsNorm(elem.orig_title || elem.nameOriginal, normOrig) || titleFieldContainsNorm(elem.en_title || elem.nameEn, normOrig) || titleFieldContainsNorm(elem.title || elem.ru_title || elem.nameRu, normOrig);
                        });
                        if (_tmp.length) {
                            cards = _tmp;
                            is_sure = true;
                        }
                    }
                    if (normCardTitle) {
                        var _tmp2 = cards.filter(function (elem) {
                            return titleFieldContainsNorm(elem.title || elem.ru_title || elem.nameRu, normCardTitle) || titleFieldContainsNorm(elem.en_title || elem.nameEn, normCardTitle) || titleFieldContainsNorm(elem.orig_title || elem.nameOriginal, normCardTitle);
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
                        if (normOrig) {
                            is_sure |= equalTitleNormalized(normalizeTitle(cards[0].orig_title || cards[0].nameOriginal), normOrig) || equalTitleNormalized(normalizeTitle(cards[0].en_title || cards[0].nameEn), normOrig) || equalTitleNormalized(normalizeTitle(cards[0].title || cards[0].ru_title || cards[0].nameRu), normOrig);
                        }
                        if (normCardTitle) {
                            is_sure |= equalTitleNormalized(normalizeTitle(cards[0].title || cards[0].ru_title || cards[0].nameRu), normCardTitle) || equalTitleNormalized(normalizeTitle(cards[0].en_title || cards[0].nameEn), normCardTitle) || equalTitleNormalized(normalizeTitle(cards[0].orig_title || cards[0].nameOriginal), normCardTitle);
                        }
                    }
                }
                if (cards.length == 1 && is_sure) {
                    var id = cards[0].kp_id || cards[0].kinopoisk_id || cards[0].kinopoiskId || cards[0].filmId;
                    var base_search = function base_search() {
                        network.clear();
                        network.timeout(15000);
                        network.silent(params.url + KP_API_PATH_FILMS_V22 + '/' + id, function (data) {
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

        function cleanTitle(str) {
            if (str === undefined || str === null) return '';
            return String(str).replace(/[\s.,:;’'`!?]+/g, ' ').trim();
        }

        function kpCleanTitle(str) {
            return cleanTitle(str).replace(/^[ \/\\]+/, '').replace(/[ \/\\]+$/, '').replace(/\+( *[+\/\\])+/g, '+').replace(/([+\/\\] *)+\+/g, '+').replace(/( *[\/\\]+ *)+/g, '+');
        }

        function normalizeTitle(str) {
            if (str === undefined || str === null) return '';
            return cleanTitle(String(str).toLowerCase().replace(/[\-‐-―⸺⸻﹘﹣－]+/g, '-').replace(/ё/g, 'е'));
        }

        function titleFieldContainsNorm(fieldVal, normSearch) {
            return typeof fieldVal === 'string' && typeof normSearch === 'string' && normSearch.length > 0 && normalizeTitle(fieldVal).indexOf(normSearch) !== -1;
        }

        function equalTitleNormalized(normField, normSearch) {
            return typeof normField === 'string' && typeof normSearch === 'string' && normSearch.length > 0 && normField === normSearch;
        }

        function showError(error) {
            if (cardElement) {
                if (cardElement.dataset) delete cardElement.dataset.kpInflightId;
                return;
            }
            Lampa.Noty.show('Рейтинг KP: ' + error);
        }

        function _getCache(movie) {
            var timestamp = new Date().getTime();
            if (kpRatingCacheMap[movie]) {
                if ((timestamp - kpRatingCacheMap[movie].timestamp) > params.cache_time) {
                    delete kpRatingCacheMap[movie];
                    Lampa.Storage.set('kp_rating', kpRatingCacheMap);
                    return false;
                }
            } else return false;
            return kpRatingCacheMap;
        }

        function _setCache(movie, data) {
            var timestamp = new Date().getTime();
            if (!kpRatingCacheMap[movie]) {
                kpRatingCacheMap[movie] = data;
                Lampa.Storage.set('kp_rating', kpRatingCacheMap);
            } else {
                if ((timestamp - kpRatingCacheMap[movie].timestamp) > params.cache_time) {
                    data.timestamp = timestamp;
                    kpRatingCacheMap[movie] = data;
                    Lampa.Storage.set('kp_rating', kpRatingCacheMap);
                } else data = kpRatingCacheMap[movie];
            }
            return data;
        }

        function _showRating(data) {
            if (!data) return;

            if (cardElement) {
                applyCardPosterRating(cardElement, data, card);
                if (cardElement.dataset) delete cardElement.dataset.kpInflightId;
                return;
            }

            var render = fullRender || Lampa.Activity.active().activity.render();
            $('.wait_rating', render).remove();
            var hasKp = hasPositiveRating(data.kp);
            var hasImdb = hasPositiveRating(data.imdb);
            var tmdbN = tmdbVoteAverage(card);
            var hasTmdb = tmdbN > 0;

            var $r = $(render);
            var $kp = $r.find('.rate--kp');
            var $imdb = $r.find('.rate--imdb');
            var $tmdb = $r.find('.rate--tmdb');
            var $kpText = $kp.find('> div').eq(0);
            var $imdbText = $imdb.find('> div').eq(0);
            var $tmdbText = $tmdb.find('> div').eq(0);

            if (hasKp) {
                $kp.removeClass('hide');
                $kpText.text(formatRatingDisplay(data.kp));
            } else {
                $kp.addClass('hide');
            }
            if (hasImdb) {
                $imdb.removeClass('hide');
                $imdbText.text(formatRatingDisplay(data.imdb));
            } else {
                $imdb.addClass('hide');
            }
            if (!hasKp && !hasImdb && hasTmdb) {
                $tmdb.removeClass('hide');
                $tmdbText.text(formatRatingDisplay(tmdbN));
            } else {
                $tmdb.addClass('hide');
            }
            reorderFullPageRatingsKpFirst($r);
        }
    }

    function initRatings() {
        window.rating_plugin = true;

        /* Remote-diagnosis aid: if this says DISABLED, the mi_rating
           trigger is off in this device's storage - flip it in
           Settings -> My Interface. If it says enabled but no ratings
           appear, filter the console by "kinopoisk" for request errors. */
        console.log('My Interface:', 'ratings ' + (miEnabled('mi_rating') ? 'enabled' : 'DISABLED via the mi_rating setting'));

        patchScrollAppendMirrorCardData();
        patchLayerVisibleForCatalog();

        scheduleCatalogCardScan(getCatalogScanRoot(), 0);
        setTimeout(function () {
            patchLayerVisibleForCatalog();
            scheduleCatalogCardScan(getCatalogScanRoot(), 0);
        }, 180);

        if (window.Lampa && Lampa.Listener) {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') {
                    patchLayerVisibleForCatalog();
                    scheduleCatalogCardScan(getCatalogScanRoot(), 0);
                }
            });
        }

        new MutationObserver(function (mutations) {
            if (mutationAddsCards(mutations)) scheduleCatalogCardScan(getCatalogScanRoot());
        }).observe(document.body, { childList: true, subtree: true });

        Lampa.Listener.follow('full', function (e) {
            if (!miEnabled('mi_rating')) return;
            if (e.type == 'build' && e.name == 'start' && e.body) {
                reorderFullPageRatingsKpFirst(e.body);
            }
            if (e.type == 'complite') {
                var render = e.object.activity.render();
                if (!hasKpCache(e.data.movie.id) && !$('.wait_rating', render).length) {
                    $('.info__rate', render).after('<div style="width:2em;margin-top:1em;margin-right:1em" class="wait_rating"><div class="broadcast__scan"><div></div></div><div>');
                }
                rating_kp_imdb(e.data.movie, { render: render });
            }
        });
    }

    /* ================================================================
     * 3. F2 - TMDB logo instead of the title (ported logo.js)
     * ================================================================ */

    function initLogos() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type != 'complite') return;
            if (!miEnabled('mi_logo')) return;
            if (!e.data || !e.data.movie) return;

            var movie = e.data.movie;
            if (movie.id === '' || movie.id === undefined || movie.id === null) return;

            var type = movie.name ? 'tv' : 'movie';
            var url = Lampa.TMDB.api(type + '/' + movie.id + '/images?api_key=' + Lampa.TMDB.key() + '&language=' + Lampa.Storage.get('language'));

            $.get(url, function (resp) {
                if (resp.logos && resp.logos[0]) {
                    var logo = resp.logos[0].file_path;
                    if (logo != '') {
                        e.object.activity.render().find('.full-start-new__title').html(
                            '<img style="margin-top:5px;max-height:125px;" src="' + Lampa.TMDB.image('/t/p/w300' + logo.replace('.svg', '.png')) + '"/>'
                        );
                    }
                }
            });
        });
    }

    /* ================================================================
     * 4. F3 - header element filter (ported head_filter.js,
     *    storage keys head_filter_show_* kept for compatibility)
     * ================================================================ */

    function initHeadFilter() {
        function showHideElement(element, show) {
            if (show === false) $(element).hide();
            else $(element).show();
        }

        function applyAll() {
            Object.keys(HEAD_ELEMENTS).forEach(function (key) {
                showHideElement(HEAD_ELEMENTS[key].element, Lampa.Storage.get(key, true));
            });
        }

        Lampa.Storage.listener.follow('change', function (event) {
            if (event.name == 'activity') {
                setTimeout(applyAll, 1000);
            } else if (HEAD_ELEMENTS[event.name]) {
                showHideElement(HEAD_ELEMENTS[event.name].element, Lampa.Storage.get(event.name, true));
            }
        });

        setTimeout(applyAll, 1000);
    }

    /* ================================================================
     * 5. F4 - show all source buttons on the film page
     *
     * Stock Lampa keeps source buttons (torrents, trailer, online
     * plugins) in a hidden ".buttons--container"; the Play button opens
     * a Select with them. We move them into the visible row instead.
     * The stock groupButtons handler then hides Play by itself because
     * the container is empty (full/start/buttons.js).
     * ================================================================ */

    function initAllButtons() {
        var STYLE_ID = 'mi-all-buttons-style';

        function ensureStyle() {
            if (document.getElementById(STYLE_ID)) return;
            var style = document.createElement('style');
            style.id = STYLE_ID;
            style.innerHTML = '.full-start-new__buttons{flex-wrap:wrap}' +
                '.full-start-new__buttons .full-start__button{margin-bottom:0.3em}';
            document.body.appendChild(style);
        }

        /* Requested order: torrents, online sources, trailers,
           favorites (book), everything else, then the "..." dots */
        function orderWeight(node) {
            var cls = node.className || '';
            if (cls.indexOf('view--torrent') >= 0) return 1;
            if (cls.indexOf('online') >= 0) return 2;
            if (cls.indexOf('view--trailer') >= 0) return 3;
            if (cls.indexOf('button--book') >= 0) return 4;
            if (cls.indexOf('button--options') >= 0) return 9;
            return 5;
        }

        function reorderRow(row) {
            var buttons = row.children('.full-start__button').get();
            var indexed = [];
            for (var i = 0; i < buttons.length; i++) {
                indexed.push({ node: buttons[i], weight: orderWeight(buttons[i]), pos: i });
            }
            indexed.sort(function (a, b) {
                return a.weight - b.weight || a.pos - b.pos;
            });
            for (var j = 0; j < indexed.length; j++) {
                row.append(indexed[j].node);
            }
        }

        function sweep(render) {
            if (!miEnabled('mi_all_buttons')) return;
            if (!render || !render.find) return;

            var row = render.find('.full-start-new__buttons');
            var container = render.find('.buttons--container');
            if (!row.length || !container.length) return;

            ensureStyle();

            var buttons = container.find('.full-start__button').not('.hide');
            if (buttons.length) {
                buttons.addClass('selector');
                row.append(buttons);
            }

            /* All buttons are visible now - the priority clone and the
               sources-menu Play button are redundant */
            row.find('.button--priority').remove();
            if (!container.find('.full-start__button').not('.hide').length) {
                row.find('.button--play').addClass('hide');
            }

            reorderRow(row);
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type != 'complite') return;
            if (!e.object || !e.object.activity) return;

            var render = e.object.activity.render();

            /* Sync sweep runs before stock groupButtons; the delayed ones
               catch buttons that online plugins add asynchronously */
            sweep(render);
            setTimeout(function () { sweep(render); }, 300);
            setTimeout(function () { sweep(render); }, 1200);
            setTimeout(function () { sweep(render); }, 3000);
        });
    }

    /* ================================================================
     * 6. F5 - Favorites: hide/rename default bookmark categories,
     *    plus a Browsing history row on the Bookmarks page.
     *
     * Storage: one key (my_interface_favs):
     *   { version, defaults: { hidden: [type], renamed: { type: name } } }
     *
     * Hooks (data-level only, no DOM rewriting):
     *   H1 Select 'preshow'  - filter hidden categories out of the
     *      film-page/card bookmark menus; drop orphaned separators
     *      (e.g. the CUB "Status" section when every mark is hidden)
     *   H2 Favorite.all      - hide categories on the Bookmarks page
     *   H5 Lang.translate    - rename default categories everywhere
     *   H6 ContentRows row   - Browsing history row on the Bookmarks
     *      page (stock excludes history from its category rows)
     * ================================================================ */

    var MyFavorites = (function () {
        var state = null;

        /* ---------------- storage ---------------- */

        function load() {
            state = Lampa.Storage.get(FAVS_STORAGE_KEY, '{}');
            if (!state || typeof state !== 'object' || isArr(state)) state = {};
            if (!state.version) state.version = 1;
            if (!state.defaults || typeof state.defaults !== 'object') state.defaults = {};
            if (!isArr(state.defaults.hidden)) state.defaults.hidden = [];
            if (!state.defaults.renamed || typeof state.defaults.renamed !== 'object') state.defaults.renamed = {};

            /* leftovers from the removed custom-lists feature */
            delete state.lists;
            delete state.items;
            delete state.cards;
            delete state.migrated_levende;
        }

        function save() {
            Lampa.Storage.set(FAVS_STORAGE_KEY, state);
        }

        /* ---------------- H2: hide categories on Bookmarks page ------ */

        function hookFavorite() {
            var F = Lampa.Favorite;
            if (!F || F.__mi_favs_patched) return;
            F.__mi_favs_patched = true;

            var origAll = F.all;

            if (origAll) F.all = function () {
                var res = origAll.apply(F, arguments);
                state.defaults.hidden.forEach(function (type) {
                    if (res[type]) res[type] = [];
                });
                return res;
            };
        }

        /* ---------------- H5: rename defaults via Lang ---------------- */

        function hookLang() {
            if (Lampa.Lang.__mi_favs_patched) return;
            Lampa.Lang.__mi_favs_patched = true;

            var origTranslate = Lampa.Lang.translate;

            Lampa.Lang.translate = function (name, code) {
                if (typeof name === 'string') {
                    if (name.indexOf('title_') === 0) {
                        var type = name.substring(6);
                        if (state.defaults.renamed[type]) return state.defaults.renamed[type];
                    } else if (name.indexOf('#{') >= 0) {
                        name = name.replace(/#\{title_([a-z_0-9-]+)\}/g, function (m, type) {
                            return state.defaults.renamed[type] ? state.defaults.renamed[type] : m;
                        });
                    }
                }
                return origTranslate(name, code);
            };
        }

        /* ---------------- H1: bookmark menus via Select preshow ------- */

        function hookSelect() {
            if (!(Lampa.Select && Lampa.Select.listener && Lampa.Select.listener.follow)) return;

            Lampa.Select.listener.follow('preshow', function (e) {
                var active = e.active;
                if (!active || !isArr(active.items) || active.__mi_favs_done) return;

                var items = active.items;
                var matches = 0;

                for (var i = 0; i < items.length; i++) {
                    var key = items[i].type || items[i].where;
                    if (key && FAV_CATEGORIES.indexOf(key) >= 0) matches++;
                }

                /* The film-page menu and card context menu always carry
                   at least four category entries */
                if (matches < 2) return;

                active.__mi_favs_done = true;

                var hidden = state.defaults.hidden;
                if (!hidden.length) return;

                /* Do not produce a completely empty menu */
                var remaining = 0;
                for (var r = 0; r < items.length; r++) {
                    var rk = items[r].type || items[r].where;
                    if (!(rk && hidden.indexOf(rk) >= 0) && !items[r].separator) remaining++;
                }
                if (!remaining) return;

                for (var j = items.length - 1; j >= 0; j--) {
                    var jk = items[j].type || items[j].where;
                    if (jk && hidden.indexOf(jk) >= 0) items.splice(j, 1);
                }

                /* Drop separators left without entries - e.g. the CUB
                   "Status" section when all mark categories are hidden */
                for (var s = items.length - 1; s >= 0; s--) {
                    if (items[s].separator) {
                        var next = items[s + 1];
                        if (!next || next.separator) items.splice(s, 1);
                    }
                }
            });
        }

        /* ---------------- H6: Browsing history row --------------------
         * History can live in two places depending on the backend:
         * Favorite.get (local mode, or Account.Bookmarks under CUB sync)
         * and the raw 'favorite' storage object. Lampac's bookmark.js
         * plugin overwrites the whole 'favorite' object from its server,
         * and CUB-sync setups may not carry history at all - so read
         * both and use whichever actually has films. */

        function localHistoryCards() {
            var fav = Lampa.Storage.get('favorite', '{}');
            if (!fav || typeof fav !== 'object') return [];

            var ids = isArr(fav.history) ? fav.history : [];
            var cards = isArr(fav.card) ? fav.card : [];
            var result = [];

            for (var i = 0; i < ids.length; i++) {
                for (var j = 0; j < cards.length; j++) {
                    if (String(cards[j].id) === String(ids[i])) {
                        result.push(cards[j]);
                        break;
                    }
                }
            }
            return result;
        }

        function historyCards() {
            var viaApi = [];
            try { viaApi = Lampa.Favorite.get({ type: 'history' }) || []; } catch (e) {}
            var viaLocal = localHistoryCards();
            return viaApi.length >= viaLocal.length ? viaApi : viaLocal;
        }

        function openCard(item) {
            if (Lampa.Router && Lampa.Router.call) Lampa.Router.call('full', item);
            else Lampa.Activity.push({
                url: '',
                component: 'full',
                id: item.id,
                method: item.name ? 'tv' : 'movie',
                card: item,
                source: item.source || 'tmdb'
            });
        }

        function openHistoryPage(page) {
            if (Lampa.Router && Lampa.Router.call) Lampa.Router.call('favorite', { type: 'history', page: page });
            else Lampa.Activity.push({
                url: '',
                component: 'favorite',
                type: 'history',
                title: Lampa.Lang.translate('title_history'),
                page: page
            });
        }

        function registerHistoryRow() {
            if (!Lampa.ContentRows) return;

            Lampa.ContentRows.add({
                name: 'mi_history',
                title: Lampa.Lang.translate('title_history'),
                screen: 'bookmarks',
                index: 999,
                call: function () {
                    /* never let an error here break the Bookmarks page build */
                    try { return buildHistoryLine(); }
                    catch (e) { console.error('My Interface:', 'history row failed -', e && e.message ? e.message : e); }
                }
            });

            function buildHistoryLine() {
                    if (state.defaults.hidden.indexOf('history') >= 0) return;

                    var cards = historyCards();
                    if (!cards.length) return;

                    var items = cloneObj(cards.slice(0, 20));

                    items.forEach(function (item) {
                        item.params = {
                            emit: {
                                onEnter: function () {
                                    openCard(item);
                                },
                                onFocus: function () {
                                    if (Lampa.Background && Lampa.Utils.cardImgBackground) {
                                        Lampa.Background.change(Lampa.Utils.cardImgBackground(item));
                                    }
                                }
                            }
                        };
                    });

                    return {
                        title: Lampa.Lang.translate('title_history'),
                        results: items,
                        type: 'history',
                        total_pages: cards.length > 20 ? Math.ceil(cards.length / 20) : 1,
                        params: {
                            emit: {
                                onMore: function () {
                                    openHistoryPage(2);
                                }
                            }
                        }
                    };
            }
        }

        /* The top register strip on the Bookmarks page (category buttons
           with film totals) is built from a hardcoded category list in
           components/bookmarks.js - history is never in it. The whole
           `lines` array passes through ContentRows.call('bookmarks',...),
           so wrap it and append a history entry, reusing the module/
           createInstance wiring of a native entry so it renders and
           focuses exactly like the stock buttons. */

        function hookContentRowsCall() {
            var CR = Lampa.ContentRows;
            if (!CR || CR.__mi_favs_patched) return;
            CR.__mi_favs_patched = true;

            var origCall = CR.call;

            CR.call = function (screen, params, calls) {
                if (screen === 'bookmarks') {
                    try { injectHistoryRegister(calls); }
                    catch (e) { console.error('My Interface:', 'history register failed -', e && e.message ? e.message : e); }
                }
                return origCall.apply(CR, arguments);
            };
        }

        function injectHistoryRegister(lines) {
            if (!isArr(lines)) return;
            if (state.defaults.hidden.indexOf('history') >= 0) return;

            /* the register line: entries carry count + createInstance */
            var register = null;
            for (var i = 0; i < lines.length; i++) {
                var res = lines[i] && lines[i].results;
                if (isArr(res) && res.length && res[0] && res[0].count !== undefined && res[0].params && res[0].params.createInstance) {
                    register = res;
                    break;
                }
            }
            if (!register) return;

            for (var j = 0; j < register.length; j++) {
                if (register[j].mi_history) return;
            }

            var cards = historyCards();
            if (!cards.length) return;

            var sample = register[0];

            register.push({
                mi_history: true,
                title: Lampa.Lang.translate('title_history'),
                count: cards.length,
                limit: sample.limit !== undefined ? sample.limit : 0,
                params: {
                    module: sample.params.module,
                    createInstance: sample.params.createInstance,
                    emit: {
                        onEnter: function () {
                            openHistoryPage(1);
                        }
                    }
                }
            });
        }

        /* ---------------- settings UI (Select stacks) ---------------- */

        function backToSettings() {
            Lampa.Controller.toggle('settings_component');
        }

        function promptName(value, callback) {
            Lampa.Input.edit({
                title: translate('mi_favs_name'),
                value: value || '',
                free: true,
                nosave: true
            }, function (name) {
                callback((name || '').replace(/^\s+|\s+$/g, ''));
            });
        }

        function openDefaults() {
            var items = FAV_CATEGORIES.map(function (type) {
                var isHidden = state.defaults.hidden.indexOf(type) >= 0;
                return {
                    title: Lampa.Lang.translate('title_' + type),
                    subtitle: translate(isHidden ? 'mi_favs_hidden' : 'mi_favs_visible'),
                    mi_type: type
                };
            });

            Lampa.Select.show({
                title: translate('mi_favs_defaults'),
                items: items,
                onBack: backToSettings,
                onSelect: function (a) {
                    openDefaultActions(a.mi_type);
                }
            });
        }

        function openDefaultActions(type) {
            var isHidden = state.defaults.hidden.indexOf(type) >= 0;
            var items = [
                { title: translate(isHidden ? 'mi_favs_show' : 'mi_favs_hide'), action: 'toggle' },
                { title: translate('mi_favs_rename'), action: 'rename' }
            ];

            if (state.defaults.renamed[type]) {
                items.push({ title: translate('mi_favs_reset_name'), action: 'reset' });
            }

            Lampa.Select.show({
                title: Lampa.Lang.translate('title_' + type),
                items: items,
                onBack: openDefaults,
                onSelect: function (a) {
                    if (a.action == 'toggle') {
                        if (isHidden) {
                            for (var i = state.defaults.hidden.length - 1; i >= 0; i--) {
                                if (state.defaults.hidden[i] === type) state.defaults.hidden.splice(i, 1);
                            }
                        }
                        else state.defaults.hidden.push(type);
                        save();
                        openDefaults();
                    }
                    else if (a.action == 'rename') {
                        promptName(state.defaults.renamed[type] || '', function (name) {
                            if (name) {
                                state.defaults.renamed[type] = name;
                                save();
                            }
                            openDefaults();
                        });
                    }
                    else if (a.action == 'reset') {
                        delete state.defaults.renamed[type];
                        save();
                        openDefaults();
                    }
                }
            });
        }

        /* ---------------- init ---------------- */

        function init() {
            if (window.my_interface_favs_ready) return;
            window.my_interface_favs_ready = true;

            load();

            hookLang();
            hookFavorite();
            hookSelect();
            hookContentRowsCall();
            registerHistoryRow();
        }

        return {
            init: init,
            openDefaults: openDefaults
        };
    })();

    /* ================================================================
     * 7. Boot
     * ================================================================ */

    var PLUGIN_VERSION = '1.2.0';

    /* Each feature inits in isolation: one feature failing on an exotic
       Lampa build/runtime (e.g. Lampac bundles, TV WebViews) must not
       kill the features after it in the boot chain. Failures are
       tagged in the console for remote diagnosis. */
    function safeInit(name, fn) {
        try { fn(); }
        catch (e) {
            console.error('My Interface:', name, 'init failed -', e && e.stack ? e.stack : e);
        }
    }

    function startPlugin() {
        console.log('My Interface', PLUGIN_VERSION, 'loaded on', Lampa.Manifest ? 'Lampa ' + Lampa.Manifest.app_version : 'unknown Lampa');

        Lampa.Manifest.plugins = {
            type: 'other',
            version: PLUGIN_VERSION,
            name: translate('mi_settings_name'),
            description: translate('mi_settings_descr'),
            component: 'my_interface'
        };

        /* Legacy logo.js setting: '1' meant "hide logos". Note: values are
           written as strings - Lampa.Storage.get swallows an in-memory
           boolean false via its `value || empty` default fallback */
        if (Lampa.Storage.get('logo_glav') == '1' && Lampa.Storage.get('mi_logo_migrated') !== true) {
            Lampa.Storage.set('mi_logo', 'false');
            Lampa.Storage.set('mi_logo_migrated', 'true');
        }

        safeInit('settings', initSettings);
        safeInit('head-filter', initHeadFilter);
        safeInit('logos', initLogos);
        safeInit('all-buttons', initAllButtons);
        safeInit('ratings', initRatings);
        safeInit('favorites', MyFavorites.init);
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
