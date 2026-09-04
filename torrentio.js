(function () {
    'use strict';

    /* Torrentio for Lampa.
       Films  - results are appended to the stock Torrents list.
       Series - every aired episode banner on the film page opens that
                episode's own torrent list, because the addon answers
                per episode while the stock screen is title-level. */

    if (window.torrentio_plugin) return;
    window.torrentio_plugin = true;

    var PLUGIN_VERSION = '1.1.0';

    var HOST = 'https://torrentio.strem.fun';
    var PROVIDERS = 'thepiratebay,yts,eztv,1337x,torrentgalaxy,rutor,rutracker';

    var CACHE_TTL = 10 * 60 * 1000;
    var REQUEST_TIMEOUT = 12000;

    /* seeders / size / provider are embedded in the stream title text
       (person, floppy, gear glyphs) - matched by escape so this file
       stays pure ASCII and survives any re-encoding on upload */
    var RE_SEED = /👤\s*(\d+)/;
    var RE_SIZE = /💾\s*([\d.]+)\s*([KMGT]?B)/i;
    var RE_PROV = /⚙️?\s*([^\s\n]+)/;
    var RE_BTIH = /btih:([a-z0-9]{32,40})/i;

    /* Stremio clients bring their own tracker list, the addon ships
       none - TorrServer gets DHT plus these */
    var TRACKERS = [
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://open.demonii.com:1337/announce',
        'udp://open.stealth.si:80/announce',
        'udp://tracker.torrent.eu.org:451/announce',
        'udp://exodus.desync.com:6969/announce'
    ];

    var UNITS = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 };

    var imdbCache = {};
    var listCache = {};

    var network = new Lampa.Reguest();

    /* ================================================================
     * 0. Language strings (en + ru)
     * ================================================================ */

    Lampa.Lang.add({
        torrentio_settings_name: { en: 'Torrentio', ru: 'Torrentio' },
        torrentio_settings_descr: { en: 'Extra torrent sources: The Pirate Bay, 1337x, YTS, EZTV, TorrentGalaxy', ru: 'Дополнительные источники торрентов: The Pirate Bay, 1337x, YTS, EZTV, TorrentGalaxy' },

        torrentio_enabled_name: { en: 'Add Torrentio results', ru: 'Добавлять результаты Torrentio' },
        torrentio_enabled_descr: { en: 'Append Torrentio torrents to the stock torrents list', ru: 'Добавлять торренты Torrentio в стандартный список торрентов' },

        torrentio_providers_name: { en: 'Providers', ru: 'Провайдеры' },
        torrentio_providers_descr: { en: 'Comma-separated provider list, leave empty for the default set', ru: 'Список провайдеров через запятую, пусто - набор по умолчанию' },

        torrentio_episodes_name: { en: 'Torrents per episode', ru: 'Торренты по эпизодам' },
        torrentio_episodes_descr: { en: 'Press an episode to open the torrents found for it - on the film card and on the seasons page. Long press marks it watched instead', ru: 'Нажатие на эпизод открывает найденные для него торренты - в карточке фильма и на странице сезонов. Долгое нажатие отмечает просмотренным' },

        torrentio_episode_empty: { en: 'Nothing found for this episode', ru: 'Для этого эпизода ничего не найдено' }
    });

    /* ================================================================
     * 1. Helpers
     * ================================================================ */

    function isArr(x) {
        return Object.prototype.toString.call(x) === '[object Array]';
    }

    function enabled(key) {
        return Lampa.Storage.get(key, true) !== false;
    }

    function providers() {
        var value = Lampa.Storage.get('torrentio_providers', '');
        if (typeof value === 'string' && value.replace(/\s/g, '') !== '') return value.replace(/\s/g, '');
        return PROVIDERS;
    }

    function isSeries(movie) {
        return !!(movie && (movie.original_name || movie.name || movie.number_of_seasons));
    }

    function pad(num) {
        num = parseInt(num, 10) || 0;
        return (num < 10 ? '0' : '') + num;
    }

    function aired(episode) {
        if (!episode || !episode.air_date) return false;
        var time = new Date((episode.air_date + '').replace(/-/g, '/')).getTime();
        return isFinite(time) && time <= Date.now();
    }

    /* the addon caps its answer at 50 streams, so its own sort decides
       WHICH 50 arrive - sort=seeders leads with multi-film junk packs
       and sort=size with near-dead remuxes; quality wins on both */
    function streamUrl(imdb, season, episode) {
        var cfg = 'providers=' + providers() + '|sort=quality';
        if (season) return HOST + '/' + cfg + '/stream/series/' + imdb + ':' + season + ':' + (episode || 1) + '.json';
        return HOST + '/' + cfg + '/stream/movie/' + imdb + '.json';
    }

    function magnet(hash, name) {
        var link = 'magnet:?xt=urn:btih:' + hash;
        if (name) link += '&dn=' + encodeURIComponent(name);
        for (var i = 0; i < TRACKERS.length; i++) link += '&tr=' + encodeURIComponent(TRACKERS[i]);
        return link;
    }

    function toBytes(num, unit) {
        var value = parseFloat(num);
        if (!(value > 0)) return 0;
        return Math.round(value * (UNITS[(unit || '').toUpperCase()] || 1));
    }

    function magnetHash(link) {
        var found = RE_BTIH.exec(link || '');
        return found ? found[1].toLowerCase() : '';
    }

    function viewed(hash) {
        try {
            var list = Lampa.Storage.cache('torrents_view', 5000, []);
            return isArr(list) && list.indexOf(hash) > -1;
        } catch (e) {
            return false;
        }
    }

    /* ================================================================
     * 2. Streams -> torrent rows
     * ================================================================ */

    /* the stock jackett() decorates every result before handing it to
       the component - injected rows need the same fields */
    function toItem(stream) {
        if (!stream || !stream.infoHash) return null;

        var meta = stream.title || '';
        var name = (meta.split('\n')[0] || stream.name || '').trim();
        if (!name) return null;

        var seed = RE_SEED.exec(meta);
        var size = RE_SIZE.exec(meta);
        var prov = RE_PROV.exec(meta);

        var item = {
            Tracker: prov ? prov[1] : 'torrentio',
            Title: name,
            Size: size ? toBytes(size[1], size[2]) : 0,
            Seeders: seed ? parseInt(seed[1], 10) : 0,
            Peers: 0,
            PublishDate: null,
            Category: [],
            Details: null,
            MagnetUri: magnet(stream.infoHash, name),
            info_hash: (stream.infoHash + '').toLowerCase()
        };

        item.PublisTime = 0;
        item.hash = Lampa.Utils.hash(item.Title);
        item.viewed = viewed(item.hash);
        item.size = Lampa.Utils.bytesToSize(item.Size);
        item.checked_at = Date.now();
        item.source_rank = 1;

        return item;
    }

    function fetchList(url, call) {
        var cached = listCache[url];
        if (cached && Date.now() - cached.time < CACHE_TTL) return call(cached.items);

        network.timeout(REQUEST_TIMEOUT);

        network.silent(url, function (json) {
            var streams = json && isArr(json.streams) ? json.streams : [];
            var items = [];

            for (var i = 0; i < streams.length; i++) {
                var item = toItem(streams[i]);
                if (item) items.push(item);
            }

            listCache[url] = { time: Date.now(), items: items };
            call(items);
        }, function () {
            call([]);
        });
    }

    /* the addon is addressed by IMDB id only (idPrefixes tt, kitsu) */
    function resolveImdb(movie, call) {
        if (!movie) return call('');

        var direct = movie.imdb_id || (movie.external_ids ? movie.external_ids.imdb_id : '');
        if (direct && /^tt\d+/.test(direct)) return call(direct);

        if (!movie.id) return call('');

        var type = isSeries(movie) ? 'tv' : 'movie';
        var key = type + ':' + movie.id;

        if (typeof imdbCache[key] === 'string') return call(imdbCache[key]);

        try {
            Lampa.Api.sources.tmdb.get(type + '/' + movie.id + '/external_ids', {}, function (json) {
                imdbCache[key] = json && json.imdb_id ? json.imdb_id : '';
                call(imdbCache[key]);
            }, function () {
                imdbCache[key] = '';
                call('');
            });
        } catch (e) {
            call('');
        }
    }

    /* an episode activity asks for exactly that episode; the plain
       Torrents button on a series asks for season 1 (which surfaces the
       packs) plus the last season (releases that exist only for it) */
    function requestUrls(params, imdb) {
        var episode = params.torrentio;
        if (episode && episode.season) return [streamUrl(imdb, episode.season, episode.episode)];

        if (!isSeries(params.movie)) return [streamUrl(imdb, 0, 0)];

        var total = params.movie.number_of_seasons || 0;
        if (total > 1) return [streamUrl(imdb, 1, 1), streamUrl(imdb, total, 1)];
        return [streamUrl(imdb, 1, 1)];
    }

    function append(params, data, call) {
        if (!data) data = { Results: [] };
        if (!isArr(data.Results)) data.Results = [];

        if (!enabled('torrentio_enabled') || params.from_search || !params.movie) return call(data);

        resolveImdb(params.movie, function (imdb) {
            if (!imdb) return call(data);

            function merge(items) {
                var seen = {};
                var added = 0;
                var i;

                for (i = 0; i < data.Results.length; i++) {
                    var known = magnetHash(data.Results[i].MagnetUri);
                    if (known) seen[known] = true;
                }

                for (i = 0; i < items.length; i++) {
                    var hash = items[i].info_hash;
                    if (hash && seen[hash]) continue;
                    seen[hash] = true;
                    data.Results.push(items[i]);
                    added++;
                }

                console.log('Torrentio: added', added, 'results for', imdb);
                call(data);
            }

            var urls = requestUrls(params, imdb);
            var pending = urls.length;
            var found = [];

            urls.forEach(function (url) {
                fetchList(url, function (items) {
                    found = found.concat(items);
                    if (--pending === 0) merge(found);
                });
            });
        });
    }

    /* ================================================================
     * 3. Parser hook
     * ================================================================ */

    /* app.js exports Parser into the global map and torrents.js calls
       that very object, so wrapping get() feeds the stock results screen */
    function hookParser() {
        if (!Lampa.Parser || typeof Lampa.Parser.get !== 'function') return;

        /* my-interface 1.11.0 shipped this same hook before it moved
           here - never let both wrap, results would double up */
        if (Lampa.Parser.torrentio_hooked || Lampa.Parser.mi_torrentio_hooked) return;

        var orig = Lampa.Parser.get;

        Lampa.Parser.torrentio_hooked = true;
        Lampa.Parser.mi_torrentio_hooked = true;

        Lampa.Parser.get = function (params, oncomplite, onerror) {
            var args = params || {};

            orig.call(Lampa.Parser, args, function (data) {
                try {
                    append(args, data, oncomplite);
                } catch (e) {
                    console.error('Torrentio:', e && e.stack ? e.stack : e);
                    oncomplite(data);
                }
            }, function (err) {
                /* a dead jackett host should not empty the whole list */
                try {
                    append(args, { Results: [] }, function (data) {
                        if (data.Results.length) oncomplite(data);
                        else onerror(err);
                    });
                } catch (e) {
                    onerror(err);
                }
            });
        };
    }

    /* ================================================================
     * 4. Episode banners - film card row and the "More" seasons page
     * ================================================================ */

    function openEpisode(movie, episode) {
        var season = episode.season_number;
        var number = episode.episode_number;
        var tag = 'S' + pad(season) + 'E' + pad(number);

        var original = movie.original_name || movie.original_title || movie.name || movie.title || '';
        var local = movie.name || movie.title || original;

        Lampa.Activity.push({
            url: '',
            title: Lampa.Lang.translate('title_torrents') + ' - ' + tag,
            component: 'torrents',
            search: original + ' ' + tag,
            search_one: local + ' ' + tag,
            search_two: original + ' ' + tag,
            clarification: true,
            movie: movie,
            page: 1,
            torrentio: { season: season, episode: number }
        });
    }

    /* The stock Mark module binds hover:enter on every episode and flips
       the watched flag. It is bound during onCreate, so it always runs
       BEFORE a params.on handler and cannot be intercepted - instead the
       state is snapshotted on focus and put back when the press turns out
       to be ours. Marking moves to a long press, which stock leaves free. */
    var marks = {};

    function timelineKey(episode) {
        return episode && episode.timeline ? episode.timeline.hash : null;
    }

    function snapshotViewed(episode) {
        var key = timelineKey(episode);
        if (!key) return;

        marks[key] = {
            time: episode.timeline.time,
            percent: episode.timeline.percent
        };
    }

    function restoreViewed(episode) {
        var key = timelineKey(episode);
        var saved = key ? marks[key] : null;
        if (!saved) return;

        if (episode.timeline.percent === saved.percent && episode.timeline.time === saved.time) return;

        episode.timeline.time = saved.time;
        episode.timeline.percent = saved.percent;

        try { Lampa.Timeline.update(episode.timeline); }
        catch (e) { console.error('Torrentio: timeline restore -', e); }
    }

    function toggleViewed(episode) {
        var line = episode ? episode.timeline : null;
        if (!line) return;

        if (line.percent) {
            line.time = 0;
            line.percent = 0;
        }
        else {
            line.time = typeof line.duration === 'number' ? line.duration * 0.95 : 0;
            line.percent = 95;
        }

        snapshotViewed(episode);

        try { Lampa.Timeline.update(line); }
        catch (e) { console.error('Torrentio: timeline update -', e); }
    }

    /* Both item modules wire every key of an item's params.on map onto its
       element (line/module/items.js and category/module/items.js). The film
       card only EXTENDS params so a pre-set map survives, but the seasons
       page ASSIGNS params wholesale - hence the accessor, which re-injects
       the handlers into whatever the component puts there. */
    function bindEpisode(episode, movie) {
        if (!episode || !aired(episode)) return;

        var current = episode.params;

        function decorate(params) {
            params = params || {};
            params.on = params.on || {};

            if (!params.on.torrentio) {
                params.on.torrentio = true;
                params.on.focus = function (item) { snapshotViewed(item || episode); };
                params.on.enter = function (item) {
                    var data = item && item.episode_number ? item : episode;
                    restoreViewed(data);
                    openEpisode(movie, data);
                };
                params.on.long = function (item) { toggleViewed(item || episode); };
            }

            return params;
        }

        try {
            Object.defineProperty(episode, 'params', {
                configurable: true,
                enumerable: true,
                get: function () { return current; },
                set: function (value) { current = decorate(value); }
            });

            episode.params = current;
        }
        catch (e) {
            episode.params = decorate(current);
        }
    }

    function episodesEnabled() {
        return enabled('torrentio_enabled') && enabled('torrentio_episodes');
    }

    /* film card: the episodes row is pushed right before the Directors and
       Actors rows, and the 'start' event fires before that happens */
    function bindFullCard(data) {
        if (!episodesEnabled()) return;
        if (!data || !data.movie || !data.episodes || !isSeries(data.movie)) return;

        [data.episodes.episodes, data.episodes.episodes_original].forEach(function (list) {
            if (!isArr(list)) return;

            list.forEach(function (episode) {
                bindEpisode(episode, data.movie);
            });
        });
    }

    function hookFullCard() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'start') bindFullCard(e.data);
        });
    }

    /* "More" seasons page: the episodes component calls Api.seasons for the
       season chosen at the top of the page and only then assigns params, so
       the data is decorated on the way out of the API */
    function hookSeasons() {
        if (!Lampa.Api || typeof Lampa.Api.seasons !== 'function') return;
        if (Lampa.Api.seasons.torrentio_hooked) return;

        var orig = Lampa.Api.seasons;

        var wrapped = function (card, from, oncomplite) {
            return orig.call(Lampa.Api, card, from, function (data) {
                try {
                    if (episodesEnabled() && data && card) {
                        for (var key in data) {
                            var season = data[key];
                            if (!season || !isArr(season.episodes)) continue;

                            season.episodes.forEach(function (episode) {
                                bindEpisode(episode, card);
                            });
                        }
                    }
                }
                catch (e) {
                    console.error('Torrentio: seasons -', e && e.stack ? e.stack : e);
                }

                oncomplite(data);
            });
        };

        wrapped.torrentio_hooked = true;

        Lampa.Api.seasons = wrapped;
    }

    /* ================================================================
     * 5. Settings
     * ================================================================ */

    function initSettings() {
        Lampa.SettingsApi.addComponent({
            component: 'torrentio',
            name: Lampa.Lang.translate('torrentio_settings_name'),
            icon: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
                '<path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<path d="M4 19h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
                '</svg>'
        });

        Lampa.SettingsApi.addParam({
            component: 'torrentio',
            param: { name: 'torrentio_enabled', type: 'trigger', default: true },
            field: { name: Lampa.Lang.translate('torrentio_enabled_name'), description: Lampa.Lang.translate('torrentio_enabled_descr') }
        });

        Lampa.SettingsApi.addParam({
            component: 'torrentio',
            param: { name: 'torrentio_episodes', type: 'trigger', default: true },
            field: { name: Lampa.Lang.translate('torrentio_episodes_name'), description: Lampa.Lang.translate('torrentio_episodes_descr') }
        });

        Lampa.SettingsApi.addParam({
            component: 'torrentio',
            param: { name: 'torrentio_providers', type: 'input', values: '', placeholder: PROVIDERS, default: '' },
            field: { name: Lampa.Lang.translate('torrentio_providers_name'), description: Lampa.Lang.translate('torrentio_providers_descr') }
        });
    }

    /* ================================================================
     * 6. Boot
     * ================================================================ */

    function safeInit(name, fn) {
        try { fn(); }
        catch (e) {
            console.error('Torrentio:', name, 'init failed -', e && e.stack ? e.stack : e);
        }
    }

    function startPlugin() {
        console.log('Torrentio', PLUGIN_VERSION, 'loaded on', Lampa.Manifest ? 'Lampa ' + Lampa.Manifest.app_version : 'unknown Lampa');

        safeInit('settings', initSettings);
        safeInit('parser', hookParser);
        safeInit('episodes', hookFullCard);
        safeInit('seasons', hookSeasons);
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
