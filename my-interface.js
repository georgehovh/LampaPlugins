(function () {
    'use strict';

    if (window.my_interface_plugin) return;
    window.my_interface_plugin = true;

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
        mi_franchise_name: { en: 'Franchise instead of Similar', ru: 'Франшиза вместо похожих' },
        mi_franchise_descr: { en: 'When a film belongs to a franchise, show its parts (oldest first) instead of the Similar row', ru: 'Если фильм входит во франшизу, показывать её части (старые первыми) вместо строки похожих' },
        mi_franchise_title: { en: 'Franchise', ru: 'Франшиза' },
        mi_air_status_name: { en: 'Series status on poster', ru: 'Статус сериала на постере' },
        mi_air_status_descr: { en: 'Replace the TV badge with the airing status everywhere (film page and cards)', ru: 'Заменять значок TV статусом выхода сериала везде (страница фильма и карточки)' },
        mi_status_returning: { en: 'Returning', ru: 'Онгоинг' },
        mi_status_ended: { en: 'Ended', ru: 'Завершён' },
        mi_status_canceled: { en: 'Canceled', ru: 'Отменён' },
        mi_status_in_production: { en: 'In Production', ru: 'В производстве' },
        mi_status_planned: { en: 'Planned', ru: 'Запланирован' },
        mi_status_pilot: { en: 'Pilot', ru: 'Пилот' },

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
        mi_favs_reset_name: { en: 'Reset name', ru: 'Сбросить название' },

        mi_account_email_name: { en: 'Lampac account email', ru: 'Email аккаунта Lampac' },
        mi_account_email_descr: { en: 'Identifies you on your Lampac server - bookmark sync and server backups are keyed to it and survive reinstalls (the device id does not)', ru: 'Идентифицирует вас на вашем сервере Lampac - синхронизация закладок и бэкапы на сервере привязаны к нему и переживают переустановку (ID устройства - нет)' },
        mi_account_email_pushed: { en: 'Bookmarks sent to the Lampac server for this email', ru: 'Закладки отправлены на сервер Lampac для этого email' }
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

        Lampa.SettingsApi.addParam({
            component: 'my_interface',
            param: { name: 'mi_franchise', type: 'trigger', default: true },
            field: { name: translate('mi_franchise_name'), description: translate('mi_franchise_descr') }
        });

        Lampa.SettingsApi.addParam({
            component: 'my_interface',
            param: { name: 'mi_air_status', type: 'trigger', default: true },
            field: { name: translate('mi_air_status_name'), description: translate('mi_air_status_descr') }
        });

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

        Lampa.SettingsApi.addParam({
            component: 'my_interface',
            param: { type: 'button' },
            field: { name: translate('mi_favs_defaults'), description: translate('mi_favs_defaults_descr') },
            onChange: function () {
                MyFavorites.openDefaults();
            }
        });

        /* Lampac's bookmark.js and backup.js key the server-side data on
           account_email, but stock Lampa offers no place to enter it */
        Lampa.SettingsApi.addParam({
            component: 'my_interface',
            param: { name: 'account_email', type: 'input', values: '', placeholder: 'user@example.com', default: '' },
            field: { name: translate('mi_account_email_name'), description: translate('mi_account_email_descr') },
            onChange: function (value) {
                pushBookmarksToLampac(value);
            }
        });
    }

    /* setting account_email switches the Lampac server identity (its
       priority is token > account_email > uid), so a device's existing
       bookmarks stay behind under the old uid identity and the next
       pull overwrites local storage with the new identity's empty set.
       Copy the CURRENT local set to the server under the new identity
       the moment the email is entered - bookmark.js's own 'bookmark_set'
       listener builds the request (correct host/token/uid params) and
       POSTs /bookmark/set. No-op without Lampac's bookmark.js. */
    function pushBookmarksToLampac(email) {
        if (!((email || '') + '').replace(/^\s+|\s+$/g, '')) return;
        if (!window.lampacBookmarkSyncInitialized) return;

        try {
            var raw = Lampa.Storage.get('favorite', '{}');
            if (!raw || typeof raw !== 'object') return;

            var payload = [];
            for (var key in raw) {
                if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
                var val = raw[key];
                if (val === null || val === undefined) continue;
                if (isArr(val) ? val.length > 0 : (typeof val === 'object' && Object.keys(val).length > 0)) {
                    payload.push({ where: key, data: val });
                }
            }
            if (!payload.length) return;

            Lampa.Listener.send('lampac', { name: 'bookmark_set', value: payload });
            Lampa.Noty.show(translate('mi_account_email_pushed'));
        } catch (e) {
            console.error('My Interface:', 'bookmark push failed -', e && e.message ? e.message : e);
        }
    }

    /* ================================================================
     * 2. KP / IMDB ratings (embedded rating.js)
     * ================================================================ */

    var CACHE_TIME_MS = 60 * 60 * 24 * 1000;            /* zero/unmatched entries */
    var KP_POSITIVE_TTL_MS = 7 * CACHE_TIME_MS;          /* real ratings barely change */
    var KP_CACHE_MAX = 2000;
    var KP_XML_TIMEOUT_MS = 3000;
    var KP_XML_RETRY_MS = 10 * 60 * 1000;
    var KP_INFLIGHT_STALE_MS = 20000;
    var KP_FAIL_COOLDOWN_MS = 20000;

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

    function hasKpCache(movieId) {
        return !!readKpCacheEntry(movieId);
    }

    function readKpCacheEntry(movieId, cacheMap) {
        var ts = new Date().getTime();
        var cache = cacheMap || Lampa.Storage.cache('kp_rating', KP_CACHE_MAX, {});
        var e = cache[movieId];
        if (!e || (ts - e.timestamp) > kpEntryTtl(e)) return null;
        return e;
    }

    /* Per-entry TTL: real ratings barely change (7 days); zero entries
       (no match / no rating) are re-checked daily */
    function kpEntryTtl(entry) {
        return (hasPositiveRating(entry.kp) || hasPositiveRating(entry.imdb)) ? KP_POSITIVE_TTL_MS : CACHE_TIME_MS;
    }

    /* Debounced persistence of the kp_rating map: mutations are visible
       in memory immediately (Lampa.Storage memoizes the object), the
       full-map localStorage write happens at most once per burst */
    var _kpSaveTimer = null;
    var _kpDirtySince = 0;
    var _kpDirty = false;

    function flushKpCache() {
        if (_kpSaveTimer) {
            clearTimeout(_kpSaveTimer);
            _kpSaveTimer = null;
        }
        if (!_kpDirty) return;
        _kpDirty = false;
        _kpDirtySince = 0;
        Lampa.Storage.set('kp_rating', Lampa.Storage.cache('kp_rating', KP_CACHE_MAX, {}), true);
    }

    function persistKpCache() {
        var now = new Date().getTime();
        _kpDirty = true;
        if (!_kpDirtySince) _kpDirtySince = now;
        if (now - _kpDirtySince > 5000) return flushKpCache();
        if (_kpSaveTimer) clearTimeout(_kpSaveTimer);
        _kpSaveTimer = setTimeout(flushKpCache, 600);
    }

    function enforceKpCacheCap(map) {
        var keys = Object.keys(map);
        while (keys.length > KP_CACHE_MAX) {
            var oldestKey = null;
            var oldestTs = Infinity;
            for (var i = 0; i < keys.length; i++) {
                var e = map[keys[i]];
                var ts = e && e.timestamp ? e.timestamp : 0;
                if (ts < oldestTs) {
                    oldestTs = ts;
                    oldestKey = keys[i];
                }
            }
            if (oldestKey === null) break;
            delete map[oldestKey];
            keys = Object.keys(map);
        }
    }

    /* One fetch chain per film id across catalog scans and the film
       page, plus a short per-film cooldown after a failed fetch */
    var _kpInflightIds = {};
    var _kpFailCooldown = {};

    /* Session circuit breaker for the TV-only rating.kinopoisk.ru XML
       hop: after 3 network failures skip straight to the API (which was
       paying the wait anyway); re-probe once every 10 minutes */
    var _kpXmlFails = 0;
    var _kpXmlOpenAt = 0;

    function xmlBreakerOpen() {
        if (_kpXmlFails < 3) return false;
        if (new Date().getTime() - _kpXmlOpenAt >= KP_XML_RETRY_MS) {
            _kpXmlFails = 2; /* half-open: allow one probe */
            return false;
        }
        return true;
    }

    function countXmlFailure(xhr) {
        if (xhr && xhr.status >= 400) return; /* host alive - not an outage */
        _kpXmlFails++;
        if (_kpXmlFails >= 3) _kpXmlOpenAt = new Date().getTime();
    }

    function getCatalogScanRoot() {
        try {
            var active = Lampa.Activity.active();
            if (active && active.activity && active.activity.render) {
                var root = active.activity.render();
                if (root && (root.jquery ? root.length : root.querySelectorAll)) return root;
            }
        } catch (e) {}
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

    var _schedulePatchScrolls = null;

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

        _schedulePatchScrolls = schedulePatchScrolls;

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

    function tryApplyCachedRatingToCard(cardEl, movieId, cardData, cacheMap) {
        var e = readKpCacheEntry(movieId, cacheMap);
        if (!e) return false;
        /* applied marker keyed to id+timestamp: skip the DOM work when
           this exact entry is already painted, repaint when the cache
           entry changed (e.g. the full-page zero-retry corrected it) */
        var marker = String(movieId) + ':' + e.timestamp;
        if (cardEl.dataset && cardEl.dataset.kpRatedId === marker) return true;
        applyCardPosterRating(cardEl, e, cardData || getCardMovieData(cardEl));
        if (cardEl.dataset) cardEl.dataset.kpRatedId = marker;
        return true;
    }

    /* one debounced entry point for everything painted onto catalog
       cards: KP/IMDB ratings and the series airing-status badge */
    function runCatalogCardScans(root) {
        scanCatalogCardsForKinopoisk(root);
        scanCardsForAirStatus(root);
    }

    function scheduleCatalogCardScan(root, debounceMs) {
        if (debounceMs === undefined) debounceMs = CATALOG_SCAN_DEBOUNCE_MS;
        if (_kpCardScanTimer) clearTimeout(_kpCardScanTimer);
        if (debounceMs <= 0) {
            runCatalogCardScans(root);
            return;
        }
        _kpCardScanTimer = setTimeout(function () {
            _kpCardScanTimer = null;
            runCatalogCardScans(root);
        }, debounceMs);
    }

    function scanCatalogCardsForKinopoisk(root) {
        if (!miEnabled('mi_rating')) return;
        var el = root;
        if (!el) el = document.body;
        if (el && el.jquery) el = el[0];
        if (!el || !el.querySelectorAll) return;
        var kpCache = Lampa.Storage.cache('kp_rating', KP_CACHE_MAX, {});
        var now = new Date().getTime();
        var cards = el.querySelectorAll('.card');
        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            if (c.classList.contains('card--parser')) continue;
            var data = getCardMovieData(c);
            if (!data || !data.id) continue;
            var mid = data.id;
            if (tryApplyCachedRatingToCard(c, mid, data, kpCache)) continue;
            var failTs = _kpFailCooldown[String(mid)];
            if (failTs && (now - failTs) < KP_FAIL_COOLDOWN_MS) continue;
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
            /* immediate pass on the freshly visible scope; the late pass
               (for card_data that mirrors a tick later) merges into the
               shared debounced scan instead of running unconditionally */
            setTimeout(function () {
                runCatalogCardScans(scope);
            }, 0);
            scheduleCatalogCardScan(getCatalogScanRoot());
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
        var kpRatingCacheMap = Lampa.Storage.cache('kp_rating', KP_CACHE_MAX, {});
        var idKey = String(card.id);
        var params = {
            id: card.id,
            url: kp_prox + KP_API_BASE_URL,
            rating_url: kp_prox + KP_RATING_XML_BASE_URL,
            headers: {
                'X-API-KEY': KP_API_KEY
            },
            cache_time: CACHE_TIME_MS
        };

        /* one chain per film id: card scans skip when any chain for this
           id is already in flight (the card repaints from cache on the
           next scan); the film page always runs its own chain */
        if (cardElement) {
            var inflightTs = _kpInflightIds[idKey];
            if (inflightTs && (new Date().getTime() - inflightTs) < KP_INFLIGHT_STALE_MS) {
                if (cardElement.dataset) delete cardElement.dataset.kpInflightId;
                return;
            }
        }
        _kpInflightIds[idKey] = new Date().getTime();

        getRating();

        function getRating() {
            var movieRating = _getCache(params.id);
            if (movieRating) {
                var entry = movieRating[params.id];

                if (fullRender && entry && !entry.vz && !hasPositiveRating(entry.kp) && !hasPositiveRating(entry.imdb)) {
                    delete kpRatingCacheMap[params.id];
                    return searchFilm();
                }
                return _showRating(entry);
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
                    /* v2.2 search items (imdbId path) already carry the
                       ratings - cache and show them, skipping the whole
                       detail round trip. Field-presence check: v2.1
                       keyword items lack these keys entirely. */
                    if (cards[0].ratingKinopoisk !== undefined || cards[0].ratingImdb !== undefined) {
                        return _showRating(_setCache(params.id, {
                            kp: cards[0].ratingKinopoisk,
                            imdb: cards[0].ratingImdb,
                            timestamp: new Date().getTime()
                        }));
                    }

                    /* provisional poster paint from the v2.1 search
                       snapshot while the authoritative fetch runs
                       (not cached - the chain overwrites it) */
                    if (cardElement) {
                        var prov = parseFloat(cards[0].rating);
                        if (!isNaN(prov) && prov > 0 && prov <= 10) {
                            setCardVoteText(cardElement, formatRatingDisplay(prov));
                        }
                    }

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

                    if (typeof AndroidJS === 'undefined' || xmlBreakerOpen()) return base_search();

                    network.clear();
                    network.timeout(KP_XML_TIMEOUT_MS);
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
                                _kpXmlFails = 0;
                                return _showRating(movieRating);
                            } catch (ex) {
                            }
                        }
                        /* 200 without <rating> = block page or junk */
                        countXmlFailure(null);
                        base_search();
                    }, function (a, c) {
                        countXmlFailure(a);
                        base_search();
                    }, false, {
                        dataType: 'text'
                    });
                } else {
                    var zeroEntry = {
                        kp: 0,
                        imdb: 0,
                        timestamp: new Date().getTime()
                    };
                    if (fullRender) zeroEntry.vz = 1; /* verified zero: searched with full data */
                    return _showRating(_setCache(params.id, zeroEntry));
                }
            } else {
                var _zeroEntry = {
                    kp: 0,
                    imdb: 0,
                    timestamp: new Date().getTime()
                };
                if (fullRender) _zeroEntry.vz = 1;
                return _showRating(_setCache(params.id, _zeroEntry));
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
            delete _kpInflightIds[idKey];
            _kpFailCooldown[idKey] = new Date().getTime();
            if (cardElement) {
                if (cardElement.dataset) delete cardElement.dataset.kpInflightId;
                return;
            }
            Lampa.Noty.show('Рейтинг KP: ' + error);
        }

        function _getCache(movie) {
            var timestamp = new Date().getTime();
            if (kpRatingCacheMap[movie]) {
                if ((timestamp - kpRatingCacheMap[movie].timestamp) > kpEntryTtl(kpRatingCacheMap[movie])) {
                    delete kpRatingCacheMap[movie];
                    persistKpCache();
                    return false;
                }
            } else return false;
            return kpRatingCacheMap;
        }

        function _setCache(movie, data) {
            var timestamp = new Date().getTime();
            if (!kpRatingCacheMap[movie]) {
                kpRatingCacheMap[movie] = data;
                enforceKpCacheCap(kpRatingCacheMap);
                persistKpCache();
            } else {
                if ((timestamp - kpRatingCacheMap[movie].timestamp) > params.cache_time) {
                    data.timestamp = timestamp;
                    kpRatingCacheMap[movie] = data;
                    persistKpCache();
                } else data = kpRatingCacheMap[movie];
            }
            return data;
        }

        function _showRating(data) {
            delete _kpInflightIds[idKey];
            if (!data) return;

            if (cardElement) {
                applyCardPosterRating(cardElement, data, card);
                if (cardElement.dataset) {
                    cardElement.dataset.kpRatedId = String(card.id) + ':' + (data.timestamp || '');
                    delete cardElement.dataset.kpInflightId;
                }
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
        console.log('My Interface:', 'ratings ' + (miEnabled('mi_rating') ? 'enabled' : 'DISABLED via the mi_rating setting'));

        /* one-time prune of expired entries so the cache cap binds on
           live data, then a single write */
        var bootMap = Lampa.Storage.cache('kp_rating', KP_CACHE_MAX, {});
        var bootNow = new Date().getTime();
        var pruned = false;
        for (var bk in bootMap) {
            if (bootMap.hasOwnProperty(bk)) {
                var be = bootMap[bk];
                if (!be || !be.timestamp || (bootNow - be.timestamp) > kpEntryTtl(be)) {
                    delete bootMap[bk];
                    pruned = true;
                }
            }
        }
        if (pruned) Lampa.Storage.set('kp_rating', bootMap, true);

        /* the debounced cache writes need a flush on app exit/background
           (Android TV kills the WebView from catalog screens mid-burst) */
        window.addEventListener('pagehide', flushKpCache);
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) flushKpCache();
        });

        patchScrollAppendMirrorCardData();
        patchLayerVisibleForCatalog();

        scheduleCatalogCardScan(getCatalogScanRoot(), 0);
        setTimeout(function () {
            patchLayerVisibleForCatalog();
            scheduleCatalogCardScan(getCatalogScanRoot(), 0);
        }, 180);

        new MutationObserver(function (mutations) {
            if (_schedulePatchScrolls) _schedulePatchScrolls();
            if ((miEnabled('mi_rating') || miEnabled('mi_air_status')) && mutationAddsCards(mutations)) {
                scheduleCatalogCardScan(getCatalogScanRoot());
            }
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
     * 3. TMDB logo instead of the title (ported logo.js)
     * ================================================================ */

    var LOGO_CACHE_MAX = 500;
    var LOGO_FOUND_TTL_MS = 30 * 24 * 60 * 60 * 1000; /* logos basically never change */
    var LOGO_MISS_TTL_MS = 24 * 60 * 60 * 1000;       /* films without a logo: re-check daily */

    function initLogos() {
        function applyLogo(e, path) {
            if (!path) return;
            e.object.activity.render().find('.full-start-new__title').html(
                '<img style="margin-top:5px;max-height:125px;" src="' + Lampa.TMDB.image('/t/p/w300' + path.replace('.svg', '.png')) + '"/>'
            );
        }

        /* prefer the UI language, then English, then language-neutral */
        function pickLogo(logos, lang) {
            var best = null;
            var bestScore = 0;
            for (var i = 0; i < logos.length; i++) {
                var l = logos[i];
                if (!l || !l.file_path) continue;
                var score = l.iso_639_1 === lang ? 3 : l.iso_639_1 === 'en' ? 2 : !l.iso_639_1 ? 1 : 0;
                if (score > bestScore) {
                    bestScore = score;
                    best = l.file_path;
                }
            }
            if (!best && logos[0] && logos[0].file_path) best = logos[0].file_path;
            return best || '';
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type != 'complite') return;
            if (!miEnabled('mi_logo')) return;
            if (!e.data || !e.data.movie) return;

            var movie = e.data.movie;
            if (movie.id === '' || movie.id === undefined || movie.id === null) return;

            var type = movie.name ? 'tv' : 'movie';
            var lang = Lampa.Storage.get('language');
            var cacheKey = type + '_' + movie.id + '_' + lang;
            var cache = Lampa.Storage.cache('mi_logo_cache', LOGO_CACHE_MAX, {});
            var entry = cache[cacheKey];

            if (entry && (new Date().getTime() - entry.t) < (entry.p ? LOGO_FOUND_TTL_MS : LOGO_MISS_TTL_MS)) {
                return applyLogo(e, entry.p);
            }

            var url = Lampa.TMDB.api(type + '/' + movie.id + '/images?api_key=' + Lampa.TMDB.key() +
                '&language=' + lang + '&include_image_language=' + lang + ',en,null');

            $.get(url, function (resp) {
                var path = resp && resp.logos ? pickLogo(resp.logos, lang) : '';
                cache[cacheKey] = { p: path, t: new Date().getTime() };
                Lampa.Storage.set('mi_logo_cache', cache, true);
                applyLogo(e, path);
            });
        });
    }

    /* ================================================================
     * Franchise instead of Similar on the film page.
     *
     * Both the tmdb and cub sources already fetch the film's collection
     * (data.collection) when it belongs to one; full.js renders it as a
     * row. The 'full' start event fires synchronously BEFORE the rows
     * are built, so dropping data.simular there replaces Similar with
     * the franchise. Films without a franchise keep Similar as is.
     * (Recommendations stay stock: the KP similars endpoint returns no
     * TMDB ids, so its items could not open film pages reliably.)
     *
     * The parts are sorted by release year (oldest first, undated/
     * upcoming last) and the row is capped at 10; a More card at the
     * end of the row opens a full grid page with every part (the tmdb
     * source itself caps collection rows at parts.slice(0,19), so the
     * grid refetches collection/{id} to get the complete list).
     * ================================================================ */

    var FRANCHISE_ROW_LIMIT = 10;

    function franchiseYear(part) {
        var date = (part && (part.release_date || part.first_air_date)) || '';
        var y = parseInt((date + '').slice(0, 4), 10);
        return isNaN(y) || y === 0 ? 9999 : y;
    }

    /* decorate-sort-undecorate: Array.sort is not stable in old WebViews */
    function sortFranchiseParts(parts) {
        var decorated = [];
        for (var i = 0; i < parts.length; i++) decorated.push({ p: parts[i], y: franchiseYear(parts[i]), i: i });
        decorated.sort(function (a, b) { return a.y - b.y || a.i - b.i; });
        var out = [];
        for (var j = 0; j < decorated.length; j++) out.push(decorated[j].p);
        return out;
    }

    /* The franchise More opens the STOCK category_full page (native
       grid, native 20-per-page pagination, native scrolling). It feeds
       through Lampa.Api.list - the dispatcher is a plain property on
       the shared Api object, so wrapping it lets a plugin serve static
       pages to the genuine component. The full parts list is fetched
       from collection/{id} on the first page (the film-page row data is
       capped at parts.slice(0,19) by the tmdb source itself). */

    var FRANCHISE_URL_MARKER = 'mi_franchise_collection';
    var FRANCHISE_PAGE_SIZE = 20;

    function openFranchisePage(collection) {
        Lampa.Activity.push({
            url: FRANCHISE_URL_MARKER,
            component: 'category_full',
            source: 'tmdb',
            title: collection.name || translate('mi_franchise_title'),
            collection_id: collection.id,
            /* fallback when the collection refetch fails (already sorted) */
            parts: collection.mi_all || collection.results || [],
            page: 1
        });
    }

    function serveFranchisePage(params, oncomplite, onerror) {
        function serve(all) {
            if (!all.length) return onerror();
            var page = params.page || 1;
            oncomplite({
                results: all.slice((page - 1) * FRANCHISE_PAGE_SIZE, page * FRANCHISE_PAGE_SIZE),
                total_pages: Math.ceil(all.length / FRANCHISE_PAGE_SIZE),
                page: page
            });
        }

        function stampSource(list) {
            for (var i = 0; i < list.length; i++) {
                if (list[i] && !list[i].source) list[i].source = 'tmdb';
            }
            return list;
        }

        if (isArr(params.mi_all_parts)) return serve(params.mi_all_parts);

        var lang = Lampa.Storage.get('language');
        var url = Lampa.TMDB.api('collection/' + params.collection_id +
            '?api_key=' + Lampa.TMDB.key() + '&language=' + lang);
        $.get(url, function (resp) {
            var parts = resp && isArr(resp.parts) && resp.parts.length
                ? sortFranchiseParts(resp.parts)
                : (isArr(params.parts) ? params.parts : []);
            params.mi_all_parts = stampSource(parts);
            serve(params.mi_all_parts);
        }).fail(function () {
            params.mi_all_parts = stampSource(isArr(params.parts) ? params.parts : []);
            serve(params.mi_all_parts);
        });
    }

    function patchApiListForFranchise() {
        if (window._miApiListPatched) return;
        window._miApiListPatched = true;
        var origList = Lampa.Api.list;
        Lampa.Api.list = function (params, oncomplite, onerror) {
            if (params && params.url === FRANCHISE_URL_MARKER) {
                return serveFranchisePage(params, oncomplite, onerror);
            }
            return origList.apply(Lampa.Api, arguments);
        };
    }

    /* poster-shaped More card kept at the END of the (componentized)
       franchise row, which is composed without its native More module.
       Lines render their cards LAZILY on horizontal scroll, so the card
       is re-appended to the scroll end on every 'append' event - else
       late cards land after it (More mid-row). */
    function trySizeMoreCard(more, items) {
        if (more.classList.contains('card-more--fixed-size')) return;
        try {
            var firstCard = items && items[0] ? items[0].render(true) : null;
            var view = firstCard ? firstCard.querySelector('.card__view') : null;
            var rect = view ? view.getBoundingClientRect() : null;
            if (rect && rect.height > 10) {
                more.style.width = (rect.width > rect.height ? rect.height : rect.width) + 'px';
                var box = more.querySelector('.card-more__box');
                if (box) box.style.height = rect.height + 'px';
                more.classList.add('card-more--fixed-size');
            }
        } catch (err) {}
    }

    function ensureFranchiseMoreCard(e) {
        if (!e.body || !e.scroll || !e.scroll.append) return;
        var bodyEl = e.body.jquery ? e.body[0] : e.body;

        var more = bodyEl._miFranchiseMoreEl;
        if (!more) {
            more = Lampa.Template.js ? Lampa.Template.js('more') : null;
            if (!more) return;
            bodyEl._miFranchiseMoreEl = more;
            more.classList.add('selector');
            var title = more.querySelector('.card-more__title');
            if (title) title.innerHTML = Lampa.Lang.translate('more');

            $(more).on('hover:focus', function () {
                try { e.scroll.update($(more), true); } catch (err) {}
            });
            $(more).on('hover:enter', function () {
                openFranchisePage(e.data);
            });
        }

        trySizeMoreCard(more, e.items);
        e.scroll.append(more); /* appendChild semantics: also MOVES it back to the end */
    }

    function initFranchise() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'start') return;
            if (!miEnabled('mi_franchise')) return;

            var d = e.data;
            if (!d || !d.movie || !d.collection || !isArr(d.collection.results)) return;

            /* a real franchise has at least one OTHER part */
            var others = 0;
            for (var i = 0; i < d.collection.results.length; i++) {
                if (d.collection.results[i] && String(d.collection.results[i].id) !== String(d.movie.id)) others++;
            }
            if (others > 0) delete d.simular;

            /* oldest first; cap the row and remember the rest for More */
            var sorted = sortFranchiseParts(d.collection.results);
            d.collection.mi_all = sorted;
            d.collection.results = sorted.slice(0, FRANCHISE_ROW_LIMIT);
            d.collection.mi_franchise_row = sorted.length > FRANCHISE_ROW_LIMIT;
        });

        /* the film-page card rows are composed WITHOUT their More module
           (Cards() strips it), so the More card is injected by hand -
           on 'visible' AND on every card 'append' (rows fill lazily;
           each append re-anchors the More card to the row end) */
        Lampa.Listener.follow('line', function (e) {
            if (e.type !== 'visible' && e.type !== 'append') return;
            if (!miEnabled('mi_franchise')) return;
            if (!e.data || !e.data.mi_franchise_row) return;
            ensureFranchiseMoreCard(e);
        });

        patchApiListForFranchise();

        /* full.js titles the collection row with title_collection -
           rename it to Franchise while the feature is on */
        var origTranslate = Lampa.Lang.translate;
        Lampa.Lang.translate = function (name, code) {
            if (name === 'title_collection' && miEnabled('mi_franchise')) {
                return origTranslate.call(Lampa.Lang, 'mi_franchise_title', code);
            }
            return origTranslate.apply(Lampa.Lang, arguments);
        };
    }

    /* ================================================================
     * Airing status instead of the TV badge - on the film page poster
     * (status comes free with the movie data) and on every catalog
     * card with a TV badge (list results carry no status field, so
     * cards need a cached tv/{id} detail lookup; film page visits
     * seed the cache for free)
     * ================================================================ */

    var TV_STATUS_KEYS = {
        'returning series': 'mi_status_returning',
        'ended': 'mi_status_ended',
        'canceled': 'mi_status_canceled',
        'cancelled': 'mi_status_canceled',
        'in production': 'mi_status_in_production',
        'planned': 'mi_status_planned',
        'pilot': 'mi_status_pilot'
    };

    var STATUS_CACHE_MAX = 500;
    var STATUS_FINAL_TTL_MS = 30 * 24 * 60 * 60 * 1000; /* ended/canceled do not change */
    var STATUS_LIVE_TTL_MS = 3 * 24 * 60 * 60 * 1000;   /* returning/planned/... can */
    var STATUS_RETRY_MS = 20000;                        /* failed/in-flight fetch cooldown */

    var _miStatusInflight = {};
    var _miStatusFail = {};
    var _miStatusPersistTimer = null;

    function statusCacheMap() {
        return Lampa.Storage.cache('mi_status_cache', STATUS_CACHE_MAX, {});
    }

    function statusEntryTtl(entry) {
        var key = TV_STATUS_KEYS[entry.s];
        if (key === 'mi_status_ended' || key === 'mi_status_canceled') return STATUS_FINAL_TTL_MS;
        return STATUS_LIVE_TTL_MS;
    }

    /* card scans fire in bursts - one trailing write instead of a
       full-map serialization per fetched series */
    function persistStatusCache() {
        if (_miStatusPersistTimer) return;
        _miStatusPersistTimer = setTimeout(function () {
            _miStatusPersistTimer = null;
            Lampa.Storage.set('mi_status_cache', statusCacheMap(), true);
        }, 600);
    }

    function flushStatusCache() {
        if (!_miStatusPersistTimer) return;
        clearTimeout(_miStatusPersistTimer);
        _miStatusPersistTimer = null;
        Lampa.Storage.set('mi_status_cache', statusCacheMap(), true);
    }

    function rememberStatus(id, status) {
        var idKey = String(id);
        var map = statusCacheMap();
        var entry = map[idKey];
        var s = String(status || '').toLowerCase();
        if (entry && entry.s === s) {
            entry.t = new Date().getTime();
        } else {
            entry = map[idKey] = { s: s, t: new Date().getTime() };
        }
        persistStatusCache();
        return entry;
    }

    function readStatusEntry(id) {
        var entry = statusCacheMap()[String(id)];
        if (!entry || typeof entry.t !== 'number') return null;
        if ((new Date().getTime() - entry.t) > statusEntryTtl(entry)) return null;
        return entry;
    }

    function paintStatusBadge(cardEl, entry) {
        var key = TV_STATUS_KEYS[entry.s];
        if (!key) return; /* unknown/missing status: keep the stock TV badge */
        var badge = cardEl.querySelector('.card__view .card__type');
        if (badge) badge.textContent = translate(key);
    }

    function markStatusApplied(cardEl, id, entry) {
        if (cardEl.dataset) cardEl.dataset.miStatusId = String(id) + ':' + entry.t;
    }

    function fetchAirStatus(id, cardEl) {
        _miStatusInflight[id] = new Date().getTime();
        var url = Lampa.TMDB.api('tv/' + id + '?api_key=' + Lampa.TMDB.key());
        $.get(url, function (resp) {
            delete _miStatusInflight[id];
            var entry = rememberStatus(id, resp && resp.status);
            if (cardEl && document.body.contains(cardEl)) {
                paintStatusBadge(cardEl, entry);
                markStatusApplied(cardEl, id, entry);
            }
            /* the same series can sit in several rows - the shared
               debounced scan paints the duplicates from cache */
            scheduleCatalogCardScan(getCatalogScanRoot());
        }).fail(function () {
            delete _miStatusInflight[id];
            _miStatusFail[id] = new Date().getTime();
        });
    }

    function scanCardsForAirStatus(root) {
        if (!miEnabled('mi_air_status')) return;
        var el = root;
        if (!el) el = document.body;
        if (el && el.jquery) el = el[0];
        if (!el || !el.querySelectorAll) return;
        var now = new Date().getTime();
        /* card--tv marks exactly the cards that carry the TV badge */
        var cards = el.querySelectorAll('.card.card--tv');
        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            var data = getCardMovieData(c);
            /* real TMDB ids only - skips the DOM-fallback synthetic ids */
            if (!data || data.id === undefined || data.id === null || !/^\d+$/.test(String(data.id))) continue;
            var id = String(data.id);
            var entry = readStatusEntry(id);
            if (entry) {
                if (c.dataset && c.dataset.miStatusId === id + ':' + entry.t) continue;
                paintStatusBadge(c, entry);
                markStatusApplied(c, id, entry);
                continue;
            }
            var failTs = _miStatusFail[id];
            if (failTs && (now - failTs) < STATUS_RETRY_MS) continue;
            var inflightTs = _miStatusInflight[id];
            if (inflightTs && (now - inflightTs) < STATUS_RETRY_MS) continue;
            fetchAirStatus(id, c);
        }
    }

    function initAirStatus() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;
            if (!miEnabled('mi_air_status')) return;

            var movie = e.data && e.data.movie;
            if (!movie || !movie.name || !movie.status) return; /* series only */

            /* free cache seed for the card badges */
            if (movie.id !== undefined && movie.id !== null && /^\d+$/.test(String(movie.id))) {
                rememberStatus(movie.id, movie.status);
            }

            var key = TV_STATUS_KEYS[String(movie.status).toLowerCase()];
            if (!key) return;

            var badge = e.object.activity.render().find('.full-start-new__poster .card__type');
            if (badge.length) badge.text(translate(key));
        });

        window.addEventListener('pagehide', flushStatusCache);
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) flushStatusCache();
        });
    }

    /* ================================================================
     * 4. Header element filter (ported head_filter.js,
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
     * 5. Show all source buttons on the film page
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

            sweep(render);
            setTimeout(function () { sweep(render); }, 300);
            setTimeout(function () { sweep(render); }, 1200);
            setTimeout(function () { sweep(render); }, 3000);
        });
    }

    /* ================================================================
     * 6. Favorites: hide/rename default bookmark categories,
     *    plus a Browsing history row on the Bookmarks page.
     * ================================================================ */

    var MyFavorites = (function () {
        var state = null;

        function load() {
            state = Lampa.Storage.get(FAVS_STORAGE_KEY, '{}');
            if (!state || typeof state !== 'object' || isArr(state)) state = {};
            if (!state.version) state.version = 1;
            if (!state.defaults || typeof state.defaults !== 'object') state.defaults = {};
            if (!isArr(state.defaults.hidden)) state.defaults.hidden = [];
            if (!state.defaults.renamed || typeof state.defaults.renamed !== 'object') state.defaults.renamed = {};
            if (state.lists || state.items || state.cards || state.migrated_levende) {
                delete state.lists;
                delete state.items;
                delete state.cards;
                delete state.migrated_levende;
                save();
            }
        }

        function save() {
            Lampa.Storage.set(FAVS_STORAGE_KEY, state);
        }

        function hookFavorite() {
            var F = Lampa.Favorite;
            if (!F || F.__mi_favs_patched) return;
            F.__mi_favs_patched = true;

            var origAll = F.all;
            var origGet = F.get;

            /* single-category callers (the favorite list pages) */
            if (origGet) F.get = function (params) {
                var res = origGet.apply(F, arguments);
                if (params && params.type && LIBRARY_TYPES.indexOf(params.type) >= 0) {
                    return richerCards(params.type, res);
                }
                return res;
            };

            /* the Bookmarks page (rows + register counts) builds from
               all(), which calls the module-INTERNAL get - the get
               wrapper above never sees it, so enrich here too */
            if (origAll) F.all = function () {
                var res = origAll.apply(F, arguments);
                LIBRARY_TYPES.forEach(function (type) {
                    if (res[type]) res[type] = richerCards(type, res[type]);
                });
                state.defaults.hidden.forEach(function (type) {
                    if (res[type]) res[type] = [];
                });
                return res;
            };
        }

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

                if (matches < 2) return;

                active.__mi_favs_done = true;

                var hidden = state.defaults.hidden;
                if (!hidden.length) return;

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

                for (var s = items.length - 1; s >= 0; s--) {
                    if (items[s].separator) {
                        var next = items[s + 1];
                        if (!next || next.separator) items.splice(s, 1);
                    }
                }
            });
        }

        var LIBRARY_TYPES = ['like', 'wath', 'book', 'history', 'look', 'viewed', 'scheduled', 'continued', 'thrown'];

        function localCategoryCards(type) {
            var fav = Lampa.Storage.get('favorite', '{}');
            if (!fav || typeof fav !== 'object') return [];

            var ids = isArr(fav[type]) ? fav[type] : [];
            var cards = isArr(fav.card) ? fav.card : [];
            var map = {};
            var result = [];

            for (var j = 0; j < cards.length; j++) {
                if (cards[j] && cards[j].id !== undefined) map['m' + cards[j].id] = cards[j];
            }
            for (var i = 0; i < ids.length; i++) {
                var card = map['m' + ids[i]];
                if (card) result.push(card);
            }
            return result;
        }

        /* sync backends (CUB) cap what they store per category (500
           free / 2000 premium) - serve whichever of backend vs local
           storage holds more */
        function richerCards(type, viaApi) {
            var api = isArr(viaApi) ? viaApi : [];
            try {
                var local = localCategoryCards(type);
                if (local.length > api.length) return local;
            } catch (e) {}
            return api;
        }

        function historyCards() {
            var viaApi = [];
            try { viaApi = Lampa.Favorite.get({ type: 'history' }) || []; } catch (e) {}
            return richerCards('history', viaApi);
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

        function hookContentRowsCall() {
            var CR = Lampa.ContentRows;
            if (!CR || CR.__mi_favs_patched) return;
            CR.__mi_favs_patched = true;

            var origCall = CR.call;

            CR.call = function (screen, params, calls) {
                if (screen === 'bookmarks') {
                    try {
                        fixRegisterLimits(calls);
                        injectHistoryRegister(calls);
                    }
                    catch (e) { console.error('My Interface:', 'history register failed -', e && e.message ? e.message : e); }
                }
                return origCall.apply(CR, arguments);
            };
        }

        /* the register line: entries carry count + createInstance */
        function findRegisterLine(lines) {
            for (var i = 0; i < lines.length; i++) {
                var res = lines[i] && lines[i].results;
                if (isArr(res) && res.length && res[0] && res[0].count !== undefined && res[0].params && res[0].params.createInstance) {
                    return res;
                }
            }
            return null;
        }

        /* under CUB sync the category buttons render "3 / 500" - show
           just the count (register/module/line.js appends the "/ limit"
           span only when limit is truthy); the counts themselves are
           uncapped by the hookFavorite() richer-list wrappers */
        function fixRegisterLimits(lines) {
            if (!isArr(lines)) return;
            var register = findRegisterLine(lines);
            if (!register) return;
            for (var i = 0; i < register.length; i++) {
                register[i].limit = 0;

                var type = registerTypeByTitle(register[i].title);
                if (type) {
                    var real = categoryCount(type);
                    if (real > register[i].count) register[i].count = real;
                }
            }
        }

        function injectHistoryRegister(lines) {
            if (!isArr(lines)) return;
            if (state.defaults.hidden.indexOf('history') >= 0) return;

            var register = findRegisterLine(lines);
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
                limit: 0,
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

        function backToSettings() {
            Lampa.Controller.toggle('settings_component');
        }

        function promptName(value, callback) {
            if (!(Lampa.Input && Lampa.Input.edit)) return callback('');

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

    var PLUGIN_VERSION = '1.10.0';

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

        if (Lampa.Storage.get('logo_glav') == '1' && Lampa.Storage.get('mi_logo_migrated') !== true) {
            Lampa.Storage.set('mi_logo', 'false');
            Lampa.Storage.set('mi_logo_migrated', 'true');
        }

        safeInit('settings', initSettings);
        safeInit('head-filter', initHeadFilter);
        safeInit('logos', initLogos);
        safeInit('franchise', initFranchise);
        safeInit('air-status', initAirStatus);
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
