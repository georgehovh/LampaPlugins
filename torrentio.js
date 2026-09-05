(function () {
    'use strict';

    /* Torrentio for Lampa.
       Films  - results are appended to the stock Torrents list.
       Series - every aired episode banner on the film page opens that
                episode's own torrent list, because the addon answers
                per episode while the stock screen is title-level. */

    if (window.torrentio_plugin) return;
    window.torrentio_plugin = true;

    var PLUGIN_VERSION = '1.3.0';

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

        torrentio_episode_mode_name: { en: 'Episode page shows', ru: 'На странице эпизода показывать' },
        torrentio_episode_mode_descr: { en: 'What to list when an episode is opened from the series page', ru: 'Что показывать при открытии эпизода из карточки сериала' },
        torrentio_mode_filter: { en: 'Everything matching that episode', ru: 'Всё, что относится к этому эпизоду' },
        torrentio_mode_only: { en: 'Torrentio results only', ru: 'Только результаты Torrentio' },

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

    /* ================================================================
     * 3. Narrowing a torrent list down to one episode
     * ================================================================ */

    /* Lampa's own TitleParser is not exported, and its episode field means
       "how many episodes are in this release" rather than "which" - so the
       season and episode ranges are read here instead. A release with no
       episode marking at all is a pack and counts as containing it.

       Every bare number group is \b-anchored: without that, the year in
       "Game of Thrones 2011 Season 1" is read as season 11 and the row is
       dropped from its own episode page. */
    function releaseSeasons(title) {
        var seasons = [];
        var m;
        var i;

        m = /\bs(\d{1,2})\s*[-–]\s*s?(\d{1,2})\b/.exec(title) ||
            /(?:сезон|season)\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\b/.exec(title) ||
            /\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(?:сезон|season)/.exec(title);

        if (m) {
            for (i = parseInt(m[1], 10); i <= parseInt(m[2], 10) && seasons.length < 40; i++) seasons.push(i);
            return seasons;
        }

        /* number-before-word stays FIRST - "1 сезон 10 серия" must read as
           season 1, not season 10 - and the \b is what keeps a year out */
        m = /\bs(\d{1,2})\s*e\d{1,3}/.exec(title) ||
            /\b(\d{1,2})\s*(?:сезон|season)/.exec(title) ||
            /(?:сезон|season)\s*(\d{1,2})\b/.exec(title) ||
            /\b(\d{1,2})x\d{1,2}\b/.exec(title) ||
            /\bs(\d{1,2})\b/.exec(title);

        if (m) seasons.push(parseInt(m[1], 10));

        return seasons;
    }

    function releaseEpisodes(title) {
        var m = /s\d{1,2}\s*e(\d{1,3})\s*[-–]\s*e?(\d{1,3})/.exec(title) ||
                /\b\d{1,2}x(\d{1,2})\s*[-–]\s*(\d{1,2})\b/.exec(title) ||
                /\b(\d{1,3})\s*[-–]\s*(\d{1,3})\s*(?:сери|episode)/.exec(title) ||
                /(?:сери[яийї]|episodes?)\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\b/.exec(title);

        if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];

        /* "12 из 12", "1- из 10" - N episodes of M are inside */
        m = /\b(\d{1,3})\s*(?:из|of|з)\s*(\d{1,3})\b/.exec(title);
        if (m) return [1, parseInt(m[1], 10)];

        /* word-first has to be tried BEFORE number-first, or "season 1
           episode 3" reads the season as the episode number */
        m = /s\d{1,2}\s*e(\d{1,3})/.exec(title) ||
            /\b\d{1,2}x(\d{1,2})\b/.exec(title) ||
            /(?:сери[яийї]|episode)\s*(\d{1,3})\b/.exec(title) ||
            /\b(\d{1,3})\s*(?:сери[яийї]|episode)(?![a-z])/.exec(title) ||
            /\be(\d{1,3})\b/.exec(title);

        if (m) return [parseInt(m[1], 10), parseInt(m[1], 10)];

        return null;
    }

    function releaseHasEpisode(title, season, episode) {
        title = (title || '').toLowerCase();

        var seasons = releaseSeasons(title);
        if (seasons.length && seasons.indexOf(season) === -1) return false;

        var range = releaseEpisodes(title);
        if (!range) return true;

        /* a year range is not an episode range */
        if (range[0] >= 1900 || range[1] >= 1900) return true;

        var from = Math.min(range[0], range[1]);
        var to = Math.max(range[0], range[1]);

        return episode >= from && episode <= to;
    }

    /* ================================================================
     * 3b. Keeping the stock sort honest
     * ================================================================ */

    /* torrents.js sorts a series by general.season DESCENDING by default, and
       its TitleParser reads "Game of Thrones 2011 Season 1" as season 2011
       (/(\d+)\s*season/ takes the year) - one such row jumps over the entire
       list. The component ASSIGNS element.general itself right after the
       parser returns, so a pre-set value would be thrown away; the correction
       goes in a SETTER instead. Only an impossible season (a year) is
       touched, so a correctly parsed row is left exactly as stock made it. */
    function repairGeneral(parsed, title) {
        if (!parsed) return parsed;

        var first = parseInt(String(parsed.season).split('-')[0], 10);
        if (!(first >= 1900)) return parsed;

        var found = releaseSeasons((title || '').toLowerCase());
        if (!found.length) found = [1];

        parsed.season = found.length > 1 ? found[0] + '-' + found[found.length - 1] : found[0];
        parsed.seasons = found;

        return parsed;
    }

    function guardGeneral(rows) {
        for (var i = 0; i < rows.length; i++) {
            guardRow(rows[i]);
        }
    }

    function guardRow(row) {
        var value;

        try {
            Object.defineProperty(row, 'general', {
                configurable: true,
                enumerable: true,
                get: function () { return value; },
                set: function (parsed) { value = repairGeneral(parsed, row.Title); }
            });
        }
        catch (e) {
            /* a sealed row keeps whatever stock parsed */
        }
    }

    function narrowToEpisode(data, params) {
        var target = params.torrentio;
        if (!target || !target.season || !isArr(data.Results)) return;

        var only = Lampa.Storage.get('torrentio_episode_mode', 'filter') === 'only';
        var kept = [];
        var dropped = 0;
        var i;

        for (i = 0; i < data.Results.length; i++) {
            var row = data.Results[i];

            /* our own rows were asked for by episode already */
            if (row.info_hash) {
                kept.push(row);
                continue;
            }

            if (!only && releaseHasEpisode(row.Title, target.season, target.episode)) kept.push(row);
            else dropped++;
        }

        if (dropped) console.log('Torrentio: episode filter dropped', dropped, 'of', data.Results.length, 'rows');

        data.Results = kept;
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
     * 4. Parser hook
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

            function done(data) {
                try { narrowToEpisode(data, args); }
                catch (e) { console.error('Torrentio: episode filter -', e && e.stack ? e.stack : e); }

                try {
                    if (enabled('torrentio_enabled') && isArr(data.Results)) guardGeneral(data.Results);
                }
                catch (e) { console.error('Torrentio: season guard -', e && e.stack ? e.stack : e); }

                oncomplite(data);
            }

            orig.call(Lampa.Parser, args, function (data) {
                try {
                    append(args, data, done);
                } catch (e) {
                    console.error('Torrentio:', e && e.stack ? e.stack : e);
                    done(data);
                }
            }, function (err) {
                /* a dead jackett host should not empty the whole list */
                try {
                    append(args, { Results: [] }, function (data) {
                        if (data.Results.length) done(data);
                        else onerror(err);
                    });
                } catch (e) {
                    onerror(err);
                }
            });
        };
    }

    /* ================================================================
     * 5. Episode banners - film card row and the "More" seasons page
     * ================================================================ */

    /* the stock Torrents button builds its query from parse_lang - an
       episode page asks the SAME question (an "Game of Thrones S01E03"
       query finds almost nothing on the russian trackers) and narrows the
       answer down to the episode afterwards */
    function searchQuery(movie) {
        var original = movie.original_name || movie.original_title || movie.name || movie.title || '';
        var local = movie.name || movie.title || original;
        var year = ((movie.first_air_date || movie.release_date || '0000') + '').slice(0, 4);

        var combinations = {
            df: original,
            df_year: original + ' ' + year,
            df_lg: original + ' ' + local,
            df_lg_year: original + ' ' + local + ' ' + year,

            lg: local,
            lg_year: local + ' ' + year,
            lg_df: local + ' ' + original,
            lg_df_year: local + ' ' + original + ' ' + year
        };

        var lang;
        try { lang = Lampa.Storage.field('parse_lang'); }
        catch (e) { lang = null; }

        return combinations[lang] || original || local;
    }

    function openEpisode(movie, episode) {
        var season = episode.season_number;
        var number = episode.episode_number;

        Lampa.Activity.push({
            url: '',
            title: Lampa.Lang.translate('title_torrents') + ' - S' + pad(season) + 'E' + pad(number),
            component: 'torrents',
            search: searchQuery(movie),
            search_one: movie.name || movie.title || '',
            search_two: movie.original_name || movie.original_title || '',
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

        /* the KEY of the params.on map is the DOM event name the module
           binds verbatim (render.on(key, ...)), so these must be the real
           hover:* events - a plain 'enter' binds an event nothing fires.
           The handler is called as (instance, data), so neither argument
           is the episode itself; the closure is the reliable reference. */
        function decorate(params) {
            params = params || {};
            params.on = params.on || {};

            /* focus covers the remote, hover and touch cover a mouse or a
               tap that reaches enter without focusing first */
            params.on['hover:focus'] = function () { snapshotViewed(episode); };
            params.on['hover:hover'] = function () { snapshotViewed(episode); };
            params.on['hover:touch'] = function () { snapshotViewed(episode); };

            params.on['hover:enter'] = function () {
                restoreViewed(episode);
                openEpisode(movie, episode);
            };

            params.on['hover:long'] = function () { toggleViewed(episode); };

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
     * 5b. Re-sorting a long list
     * ================================================================ */

    /* Changing the sort (or the filter) re-renders rows 0-19 but never resets
       object.page, so torrents.js next() carries on from wherever the user
       had scrolled to and the rows in between are never appended - visible as
       "the sort dropped half my list" on any list past 20 rows, which is most
       of them once Torrentio has added its 50. Both paths write the choice to
       storage BEFORE re-rendering, and Activity.active() returns that very
       activity object, so a change listener is enough to put the page back. */
    function hookSortPaging() {
        if (!Lampa.Storage.listener || typeof Lampa.Storage.listener.follow !== 'function') return;

        Lampa.Storage.listener.follow('change', function (e) {
            if (!e || (e.name !== 'torrents_sort' && e.name !== 'torrents_filter')) return;

            try {
                var activity = Lampa.Activity.active();

                if (activity && activity.component === 'torrents' && activity.page > 1) activity.page = 1;
            }
            catch (err) {
                console.error('Torrentio: page reset -', err && err.stack ? err.stack : err);
            }
        });
    }

    /* ================================================================
     * 6. Settings
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
            param: {
                name: 'torrentio_episode_mode',
                type: 'select',
                values: {
                    filter: Lampa.Lang.translate('torrentio_mode_filter'),
                    only: Lampa.Lang.translate('torrentio_mode_only')
                },
                default: 'filter'
            },
            field: { name: Lampa.Lang.translate('torrentio_episode_mode_name'), description: Lampa.Lang.translate('torrentio_episode_mode_descr') }
        });

        Lampa.SettingsApi.addParam({
            component: 'torrentio',
            param: { name: 'torrentio_providers', type: 'input', values: '', placeholder: PROVIDERS, default: '' },
            field: { name: Lampa.Lang.translate('torrentio_providers_name'), description: Lampa.Lang.translate('torrentio_providers_descr') }
        });
    }

    /* ================================================================
     * 7. Boot
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
        safeInit('paging', hookSortPaging);
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
