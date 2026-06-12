(function () {
    'use strict';

    if (window.ai_recommendation_plugin) return;
    window.ai_recommendation_plugin = true;

    /* ================================================================
     * AI Recommendations - Gemini-powered film/series suggestions.
     *
     * Head icon (after Search) opens a page with:
     *   - a "Recommended for you" row built from the Likes bookmarks
     *     (browsing history excluded), 10 cards + a More poster card
     *     (+10, +10 - 30 total from a single Gemini call)
     *   - a chat input; every prompt becomes a new row of 30 (10 shown)
     * The session is restored on open; the Refresh button on the top
     * row regenerates it. Chat is kept until cleared in Settings -> AI.
     *
     * Gemini: AI Studio endpoint (generativelanguage.googleapis.com),
     * JSON-schema output. "Auto" model walks the free-tier cascade and
     * falls through on 429/503/timeouts.
     * TMDB matching: Lampa's own TMDB pipeline (respects the user's
     * TMDB proxy) unless a personal key is set in Settings -> AI.
     * ================================================================ */

    /* ================================================================
     * 1. Lang
     * ================================================================ */

    Lampa.Lang.add({
        ai_rec_title: { en: 'AI Recommendations', ru: 'ИИ рекомендации' },
        ai_rec_settings_descr: { en: 'Gemini-based personal film recommendations', ru: 'Персональные рекомендации фильмов на основе Gemini' },
        ai_rec_enabled_name: { en: 'Enabled', ru: 'Включено' },
        ai_rec_enabled_descr: { en: 'Show the AI button in the header', ru: 'Показывать кнопку ИИ в шапке' },
        ai_rec_gemini_key_name: { en: 'Gemini API key', ru: 'API-ключ Gemini' },
        ai_rec_gemini_key_descr: { en: 'Free key from aistudio.google.com - required', ru: 'Бесплатный ключ с aistudio.google.com - обязателен' },
        ai_rec_model_name: { en: 'Gemini model', ru: 'Модель Gemini' },
        ai_rec_model_descr: { en: 'Auto tries the best free model and falls back on quota errors', ru: 'Авто использует лучшую бесплатную модель с переходом на запасную при исчерпании квоты' },
        ai_rec_model_auto: { en: 'Auto (best free)', ru: 'Авто (лучшая бесплатная)' },
        ai_rec_clear_name: { en: 'Clear chat', ru: 'Очистить чат' },
        ai_rec_clear_descr: { en: 'Delete the saved recommendations and the whole conversation', ru: 'Удалить сохранённые рекомендации и весь диалог' },
        ai_rec_cleared: { en: 'Chat cleared', ru: 'Чат очищен' },
        ai_rec_top_title: { en: 'Recommended for you', ru: 'Рекомендовано для вас' },
        ai_rec_refresh: { en: 'Refresh', ru: 'Обновить' },
        ai_rec_ask: { en: 'Ask AI for recommendations...', ru: 'Спросить ИИ о рекомендациях...' },
        ai_rec_prompt_title: { en: 'Describe what to recommend', ru: 'Опишите, что порекомендовать' },
        ai_rec_no_key: { en: 'Enter your Gemini API key in Settings - AI Recommendations', ru: 'Укажите API-ключ Gemini в Настройки - ИИ рекомендации' },
        ai_rec_no_likes: { en: 'Add films to Likes to get personal recommendations', ru: 'Добавьте фильмы в Нравится, чтобы получить персональные рекомендации' },
        ai_rec_loading: { en: 'Asking AI...', ru: 'Спрашиваю ИИ...' },
        ai_rec_error: { en: 'AI request failed', ru: 'Запрос к ИИ не удался' },
        ai_rec_quota: { en: 'Gemini quota exceeded, try later', ru: 'Квота Gemini исчерпана, попробуйте позже' },
        ai_rec_nothing: { en: 'Could not match the recommendations on TMDB', ru: 'Не удалось сопоставить рекомендации с TMDB' }
    });

    function translate(key) {
        return Lampa.Lang.translate(key);
    }

    function isArr(x) {
        return Object.prototype.toString.call(x) === '[object Array]';
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ================================================================
     * 2. Constants and settings access
     * ================================================================ */

    var PLUGIN_VERSION = '1.1.0';
    var COMPONENT_NAME = 'ai_recs_gemini'; /* 'ai_recommendations' is taken by a stock CUB component */
    var LIST_COMPONENT_NAME = 'ai_recs_list';
    var CHAT_KEY = 'ai_rec_chat';
    var LIST_TOTAL = 30;
    var LIST_BATCH = 10;
    var MAX_TURNS = 12;
    var LIKES_CAP = 80;
    var HISTORY_CAP = 150;

    var GEMINI_CASCADE = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
    var _stickyModel = null; /* the first cascade model that answered this session */

    function enabled() {
        return Lampa.Storage.get('ai_rec_enabled', true) !== false;
    }

    function geminiKey() {
        return (Lampa.Storage.get('ai_rec_gemini_key', '') + '').replace(/^\s+|\s+$/g, '');
    }

    function modelSetting() {
        return Lampa.Storage.get('ai_rec_model', 'auto') || 'auto';
    }

    /* ================================================================
     * 3. Plain XHR JSON helper (ES5, no fetch on old WebViews)
     * ================================================================ */

    function xhrJson(opts, ok, fail) {
        var done = false;
        var xhr = new XMLHttpRequest();

        function finish(success, a, b) {
            if (done) return;
            done = true;
            if (success) ok(a); else fail(a, b);
        }

        try {
            xhr.open(opts.method || 'GET', opts.url, true);
            xhr.timeout = opts.timeout || 20000;
            if (opts.headers) {
                for (var h in opts.headers) {
                    if (opts.headers.hasOwnProperty(h)) xhr.setRequestHeader(h, opts.headers[h]);
                }
            }
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                var data = null;
                try { data = JSON.parse(xhr.responseText); } catch (e) {}
                if (xhr.status >= 200 && xhr.status < 300 && data !== null) finish(true, data);
                else finish(false, xhr.status, data);
            };
            xhr.ontimeout = function () { finish(false, 0, null); };
            xhr.onerror = function () { finish(false, 0, null); };
            xhr.send(opts.body !== undefined ? JSON.stringify(opts.body) : null);
        } catch (e) {
            finish(false, 0, null);
        }
        return xhr;
    }

    /* ================================================================
     * 4. Gemini client
     * ================================================================ */

    var GEMINI_SCHEMA = {
        type: 'ARRAY',
        items: {
            type: 'OBJECT',
            properties: {
                title: { type: 'STRING' },
                original_title: { type: 'STRING' },
                year: { type: 'INTEGER' },
                type: { type: 'STRING', 'enum': ['movie', 'tv'] }
            },
            required: ['title', 'original_title', 'year', 'type']
        }
    };

    function geminiModels() {
        var setting = modelSetting();
        if (setting !== 'auto') return [setting];
        if (_stickyModel) {
            var rest = [];
            for (var i = 0; i < GEMINI_CASCADE.length; i++) {
                if (GEMINI_CASCADE[i] !== _stickyModel) rest.push(GEMINI_CASCADE[i]);
            }
            return [_stickyModel].concat(rest);
        }
        return GEMINI_CASCADE.slice(0);
    }

    /* ok(recsArray, modelName) / fail(messageKeyOrText) */
    function callGemini(contents, ok, fail) {
        var models = geminiModels();
        var auto = modelSetting() === 'auto';

        function attempt(idx) {
            if (idx >= models.length) return fail(translate('ai_rec_quota'));
            var model = models[idx];
            var cfg = {
                responseMimeType: 'application/json',
                responseSchema: GEMINI_SCHEMA,
                temperature: 0.9,
                maxOutputTokens: 8192
            };
            /* keep flash models from spending latency on thinking;
               2.5-pro cannot disable it, leave its default */
            if (model.indexOf('pro') === -1) cfg.thinkingConfig = { thinkingBudget: 0 };

            xhrJson({
                method: 'POST',
                url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model +
                    ':generateContent?key=' + encodeURIComponent(geminiKey()),
                headers: { 'Content-Type': 'application/json' },
                timeout: model.indexOf('pro') !== -1 ? 60000 : 30000,
                body: { contents: contents, generationConfig: cfg }
            }, function (data) {
                var cand = data && data.candidates && data.candidates[0];
                var text = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
                var recs = null;
                if (text) {
                    try { recs = JSON.parse(text); } catch (e) {}
                }
                if (isArr(recs) && recs.length) {
                    if (auto) _stickyModel = model;
                    ok(recs, model);
                } else if (auto && idx + 1 < models.length) {
                    attempt(idx + 1);
                } else {
                    fail(translate('ai_rec_error'));
                }
            }, function (status) {
                /* 429 quota / 503 overload / 0 network+timeout: walk the cascade */
                if (auto && (status === 429 || status === 503 || status === 0)) {
                    if (auto && _stickyModel === model) _stickyModel = null;
                    return attempt(idx + 1);
                }
                fail(status === 429 ? translate('ai_rec_quota') : translate('ai_rec_error') + (status ? ' (' + status + ')' : ''));
            });
        }

        attempt(0);
    }

    /* ================================================================
     * 5. Likes / history and the prompts
     * ================================================================ */

    /* sync backends (CUB account, Lampac bookmark.js) may differ from
       Favorite.get - read both and take the richer list */
    function favCards(type) {
        var a = [];
        var b = [];
        try { a = Lampa.Favorite.get({ type: type }) || []; } catch (e) {}
        try {
            var raw = JSON.parse(window.localStorage.getItem('favorite') || '{}');
            if (raw && isArr(raw[type])) b = raw[type];
        } catch (e) {}
        return b.length > a.length ? b : a;
    }

    function cardLabel(card) {
        var title = card.title || card.name || card.original_title || card.original_name || '';
        var year = ((card.release_date || card.first_air_date || '') + '').slice(0, 4);
        return year ? title + ' (' + year + ')' : title;
    }

    function promptList(cards, cap) {
        var out = [];
        for (var i = 0; i < cards.length && out.length < cap; i++) {
            var label = cardLabel(cards[i]);
            if (label) out.push('- ' + label);
        }
        return out.length ? out.join('\n') : '- (none)';
    }

    function basePrompt() {
        var likes = favCards('like');
        var history = favCards('history');
        return 'You are a film recommendation engine.\n' +
            'The user LIKES these films and series:\n' + promptList(likes, LIKES_CAP) + '\n\n' +
            'The user has ALREADY SEEN these (do not recommend them):\n' + promptList(history, HISTORY_CAP) + '\n\n' +
            'Recommend exactly ' + LIST_TOTAL + ' movies or TV series the user is most likely to enjoy, ' +
            'ordered from most recommended to least recommended.\n' +
            'Rules:\n' +
            '- Only real, existing titles that can be found on themoviedb.org.\n' +
            '- Never recommend anything from the LIKES or ALREADY SEEN lists, and never repeat a title you already recommended in this conversation.\n' +
            '- "title": the English title. "original_title": the title in its original language. "year": the first release year. "type": "movie" or "tv".';
    }

    function recLabel(rec) {
        return (rec.title || rec.original_title || '') + (rec.year ? ' (' + rec.year + ')' : '');
    }

    function compactModelTurn(state) {
        var all = [];
        var i;
        for (i = 0; i < state.items.length; i++) all.push(cardLabel(state.items[i]));
        for (i = 0; i < state.queue.length; i++) all.push(recLabel(state.queue[i]));
        return 'I recommended: ' + (all.join('; ') || '(nothing)');
    }

    /* conversation context: base prompt, then each exchange compacted;
       the final turn must always be a user turn */
    function buildContents(chat, newPrompt) {
        var contents = [{ role: 'user', parts: [{ text: basePrompt() }] }];
        if (chat.top) contents.push({ role: 'model', parts: [{ text: compactModelTurn(chat.top) }] });
        for (var i = 0; i < chat.turns.length; i++) {
            var t = chat.turns[i];
            contents.push({ role: 'user', parts: [{ text: t.prompt }] });
            contents.push({ role: 'model', parts: [{ text: compactModelTurn(t) }] });
        }
        if (newPrompt) {
            contents.push({
                role: 'user',
                parts: [{ text: newPrompt + '\n\nRecommend exactly ' + LIST_TOTAL + ' NEW items for this request, following the same rules and JSON format.' }]
            });
        } else if (contents.length > 1) {
            contents.push({
                role: 'user',
                parts: [{ text: 'Generate a fresh list of exactly ' + LIST_TOTAL + ' recommendations based on my tastes, following the same rules and JSON format.' }]
            });
        }
        return contents;
    }

    /* ================================================================
     * 6. TMDB resolver
     * ================================================================ */

    /* always Lampa's own pipeline - honors the user's TMDB proxy */
    function tmdbRequest(path, ok, fail) {
        var url = Lampa.TMDB.api(path + (path.indexOf('?') === -1 ? '?' : '&') + 'api_key=' + Lampa.TMDB.key());
        xhrJson({ url: url, timeout: 15000 }, ok, fail);
    }

    function itemYear(item) {
        var y = parseInt(((item.release_date || item.first_air_date || '') + '').slice(0, 4), 10);
        return isNaN(y) ? 0 : y;
    }

    function pickResult(results, rec) {
        if (!isArr(results) || !results.length) return null;
        if (rec.year) {
            for (var i = 0; i < results.length; i++) {
                var y = itemYear(results[i]);
                if (y && Math.abs(y - rec.year) <= 1) return results[i];
            }
        }
        return results[0];
    }

    function trimCard(c) {
        return {
            id: c.id,
            title: c.title,
            original_title: c.original_title,
            name: c.name,
            original_name: c.original_name,
            release_date: c.release_date,
            first_air_date: c.first_air_date,
            poster_path: c.poster_path,
            backdrop_path: c.backdrop_path,
            vote_average: c.vote_average,
            source: 'tmdb'
        };
    }

    /* the line component stamps `ready = true` on every rendered item -
       always hand it CLONES so the stored chat objects stay clean and
       re-render correctly on the next page open */
    function cloneCard(c) {
        var out = {};
        for (var k in c) {
            if (c.hasOwnProperty(k) && k !== 'ready') out[k] = c[k];
        }
        return out;
    }

    /* one rec -> a TMDB card or null: original_title+year, then
       title+year, then original_title without the year filter */
    function resolveRec(rec, cb) {
        var type = rec.type === 'tv' ? 'tv' : 'movie';
        var yearParam = type === 'tv' ? 'first_air_date_year' : 'primary_release_year';
        var lang = Lampa.Storage.get('language') || 'en';

        var attempts = [];
        var origQ = (rec.original_title || '').replace(/^\s+|\s+$/g, '');
        var titleQ = (rec.title || '').replace(/^\s+|\s+$/g, '');
        if (origQ) attempts.push({ q: origQ, year: true });
        if (titleQ && titleQ !== origQ) attempts.push({ q: titleQ, year: true });
        if (origQ || titleQ) attempts.push({ q: origQ || titleQ, year: false });

        function go(idx) {
            if (idx >= attempts.length) return cb(null);
            var a = attempts[idx];
            var path = 'search/' + type + '?language=' + encodeURIComponent(lang) +
                '&query=' + encodeURIComponent(a.q) +
                (a.year && rec.year ? '&' + yearParam + '=' + rec.year : '');
            tmdbRequest(path, function (data) {
                var hit = pickResult(data && data.results, rec);
                if (hit && hit.poster_path) cb(trimCard(hit));
                else go(idx + 1);
            }, function () {
                go(idx + 1);
            });
        }

        go(0);
    }

    /* drains state.queue until `count` cards resolve (4 in flight);
       skips items already shown/excluded; cb(freshCards) */
    function resolveFromQueue(state, count, excludeIds, cb) {
        var fresh = [];
        var inflight = 0;
        var finished = false;

        function isExcluded(id) {
            return excludeIds['m' + id] === true;
        }

        function finish() {
            if (finished) return;
            finished = true;
            cb(fresh);
        }

        function next() {
            if (fresh.length >= count) {
                if (inflight === 0) finish();
                return;
            }
            if (!state.queue.length) {
                if (inflight === 0) finish();
                return;
            }
            var rec = state.queue.shift();
            inflight++;
            resolveRec(rec, function (card) {
                inflight--;
                if (card && !isExcluded(card.id) && fresh.length < count) {
                    excludeIds['m' + card.id] = true;
                    fresh.push(card);
                }
                next();
            });
            if (inflight < 4) next();
        }

        next();
    }

    /* ================================================================
     * 7. Chat storage (kept until cleared in Settings -> AI)
     * ================================================================ */

    function loadChat() {
        var chat = Lampa.Storage.get(CHAT_KEY, {});
        if (!chat || typeof chat !== 'object' || isArr(chat)) chat = {};
        if (!chat.v) chat.v = 1;
        if (!isArr(chat.turns)) chat.turns = [];
        if (chat.top && !isArr(chat.top.items)) chat.top = null;
        return chat;
    }

    function saveChat(chat) {
        chat.updated = new Date().getTime();
        if (chat.turns.length > MAX_TURNS) chat.turns = chat.turns.slice(chat.turns.length - MAX_TURNS);
        Lampa.Storage.set(CHAT_KEY, chat);
    }

    function clearChat() {
        Lampa.Storage.set(CHAT_KEY, {});
    }

    /* ids of everything the user knows or was already shown */
    function knownIds(chat) {
        var ids = {};
        function addAll(cards) {
            for (var i = 0; i < cards.length; i++) {
                if (cards[i] && cards[i].id !== undefined) ids['m' + cards[i].id] = true;
            }
        }
        addAll(favCards('like'));
        addAll(favCards('history'));
        if (chat.top) addAll(chat.top.items);
        for (var t = 0; t < chat.turns.length; t++) addAll(chat.turns[t].items);
        return ids;
    }

    /* Gemini recs -> a fresh list state {items, queue, shown, model, ts} */
    function makeListState(recs, model, chat, cb) {
        var state = { items: [], queue: recs.slice(0), shown: 0, model: model, ts: new Date().getTime() };
        var excl = knownIds(chat);
        resolveFromQueue(state, LIST_BATCH, excl, function (fresh) {
            state.items = fresh;
            state.shown = fresh.length;
            cb(state);
        });
    }

    /* ================================================================
     * 8. The chat input "card" (a custom card class for one line)
     * ================================================================ */

    function InputCard(element) {
        var self = this;
        var el = document.createElement('div');
        el.className = 'ai-rec-input selector layer--visible layer--render';
        el.innerHTML =
            '<div class="ai-rec-input__icon">' +
            '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4L12 3z" fill="currentColor"/>' +
            '<path d="M19 14l.9 2.4L22 17l-2.1.7L19 20l-.9-2.3L16 17l2.1-.6L19 14z" fill="currentColor"/>' +
            '<path d="M5 14l.9 2.4L8 17l-2.1.7L5 20l-.9-2.3L2 17l2.1-.6L5 14z" fill="currentColor"/>' +
            '</svg></div>' +
            '<div class="ai-rec-input__text">' + escapeHtml(translate('ai_rec_ask')) + '</div>';

        this.create = function () {
            $(el).on('hover:focus', function () {
                if (self.onFocus) self.onFocus(el, element);
            });
            $(el).on('hover:enter', function () {
                if (self.onEnter) self.onEnter(el, element);
            });
            el.addEventListener('visible', function () {
                if (self.onVisible) self.onVisible(el, element);
            });
        };

        this.render = function (js) {
            return js ? el : $(el);
        };

        this.visible = function () {};

        this.destroy = function () {
            $(el).off();
            $(el).remove();
        };
    }

    function injectStyles() {
        if (document.getElementById('ai-rec-styles')) return;
        var style = document.createElement('style');
        style.id = 'ai-rec-styles';
        style.textContent =
            '.ai-rec-input{display:flex;align-items:center;width:36em;max-width:85%;' +
            'background:rgba(255,255,255,0.08);border-radius:1em;padding:0.9em 1.3em;margin:0.3em 0 1em}' +
            '.ai-rec-input.focus{background:#fff;color:#000}' +
            '.ai-rec-input__icon{width:2em;height:2em;margin-right:1em;flex-shrink:0}' +
            '.ai-rec-input__icon svg{width:100%;height:100%}' +
            '.ai-rec-input__text{font-size:1.2em;opacity:0.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
        document.head.appendChild(style);
    }

    /* ================================================================
     * 9. More poster card (opens the full list page) and the Refresh
     *    button on the top row
     * ================================================================ */

    function trySizeMoreCard(more, lineItems) {
        if (more.classList.contains('card-more--fixed-size')) return;
        try {
            var firstCard = lineItems && lineItems[0] ? lineItems[0].render(true) : null;
            var view = firstCard ? firstCard.querySelector('.card__view') : null;
            var rect = view ? view.getBoundingClientRect() : null;
            if (rect && rect.height > 10) {
                more.style.width = (rect.width > rect.height ? rect.height : rect.width) + 'px';
                var box = more.querySelector('.card-more__box');
                if (box) box.style.height = rect.height + 'px';
                more.classList.add('card-more--fixed-size');
            }
        } catch (e) {}
    }

    /* the row shows only the first batch - More exists whenever the
       full list holds (or can resolve) anything beyond it */
    function listHasMore(state) {
        return state.queue.length > 0 || state.items.length > state.shown;
    }

    /* standard Lampa behavior: More opens the complete list on its own
       page; the page is addressed by 'top'/turn-index so it survives
       restarts (no object refs in the activity) */
    function openListPage(lineData) {
        var prompt = lineData.ai_state && lineData.ai_state.prompt;
        Lampa.Activity.push({
            component: LIST_COMPONENT_NAME,
            title: prompt || translate('ai_rec_top_title'),
            ai_list: lineData.ai_kind === 'top' ? 'top' : lineData.ai_index,
            page: 1
        });
    }

    /* rows fill their cards LAZILY on horizontal scroll - the More card
       is re-anchored to the scroll end on every 'append' event, else
       late cards land after it (More mid-row) */
    function ensureMoreCard(e) {
        if (!e.body || !e.scroll || !e.scroll.append) return;
        var bodyEl = e.body.jquery ? e.body[0] : e.body;

        var more = bodyEl._aiMoreEl;
        if (!more) {
            more = Lampa.Template.js('more');
            if (!more) return;
            bodyEl._aiMoreEl = more;
            more.classList.add('selector');

            $(more).on('hover:focus', function () {
                try { e.scroll.update($(more), true); } catch (err) {}
            });
            $(more).on('hover:enter', function () {
                openListPage(e.data);
            });
        }

        trySizeMoreCard(more, e.items);
        e.scroll.append(more); /* appendChild semantics: also MOVES it back to the end */
    }

    /* ================================================================
     * 9b. The full list page (grid of every recommendation in a list)
     * ================================================================ */

    function AiListComponent(object) {
        var self = this;
        var html = document.createElement('div');
        var scroll = null;
        var body = null;
        var cards = [];
        var last = false;
        var destroyed = false;

        function openCard(cardEl, data) {
            Lampa.Activity.push({
                url: '',
                component: 'full',
                id: data.id,
                method: data.name ? 'tv' : 'movie',
                card: data,
                source: data.source || 'tmdb'
            });
        }

        function buildGrid(items) {
            if (destroyed) return;
            quietDeprecated();
            for (var i = 0; i < items.length; i++) {
                (function (item) {
                    if (!item || item.id === undefined || item.id === null) return;
                    var card = new Lampa.Card(cloneCard(item), { object: object });
                    card.create();
                    card.onFocus = function (target) {
                        last = target;
                        scroll.update($(target), true);
                    };
                    card.onEnter = openCard;
                    card.visible();
                    body.appendChild(card.render(true));
                    cards.push(card);
                })(items[i]);
            }
            scroll.append(body);
            html.appendChild(scroll.render(true));
            self.activity.loader(false);
            self.activity.toggle();
        }

        this.create = function () {
            scroll = new Lampa.Scroll({ mask: true, over: true, step: 250 });
            body = document.createElement('div');
            body.className = 'category-full';
            this.activity.loader(true);

            var chat = loadChat();
            var state = object.ai_list === 'top' ? chat.top : chat.turns[object.ai_list];
            if (!state || !isArr(state.items)) return buildGrid([]);
            if (!state.queue.length) return buildGrid(state.items);

            /* first visit: resolve everything still queued, persist, show all */
            resolveFromQueue(state, state.queue.length, knownIds(chat), function (fresh) {
                for (var i = 0; i < fresh.length; i++) state.items.push(fresh[i]);
                saveChat(chat);
                buildGrid(state.items);
            });
        };

        this.start = function () {
            if (destroyed) return;
            Lampa.Controller.add('content', {
                link: this,
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(last || false, scroll.render());
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                right: function () {
                    if (Navigator.canmove('right')) Navigator.move('right');
                },
                up: function () {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () {
                    if (Navigator.canmove('down')) Navigator.move('down');
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });
            Lampa.Controller.toggle('content');
        };

        this.render = function (js) {
            return js ? html : $(html);
        };

        this.pause = function () {};
        this.stop = function () {};

        this.destroy = function () {
            destroyed = true;
            for (var i = 0; i < cards.length; i++) {
                try { cards[i].destroy(); } catch (e) {}
            }
            cards = [];
            if (scroll) scroll.destroy();
            $(html).remove();
        };
    }

    function appendRefreshButton(e, onRefresh) {
        var root = e.line && e.line.render ? e.line.render(true) : null;
        var head = root ? root.querySelector('.items-line__head') : null;
        if (!head || head._aiRefresh) return;
        head._aiRefresh = true;

        var btn = document.createElement('div');
        btn.classList.add('items-line__more');
        btn.classList.add('selector');
        btn.innerHTML = escapeHtml(translate('ai_rec_refresh'));
        $(btn).on('hover:enter', onRefresh);
        head.appendChild(btn);
    }

    /* ================================================================
     * 10. The page component
     * ================================================================ */

    var _focusBottom = false; /* restore focus to the input after a chat rebuild */
    var _generating = false;

    function quietDeprecated() {
        if (window._aiRecWarnFiltered) return;
        window._aiRecWarnFiltered = true;
        var origWarn = console.warn;
        console.warn = function (msg) {
            if (typeof msg === 'string' && msg.indexOf('deprecated') !== -1 &&
                /Card|InteractionLine|InteractionMain/.test(msg)) return;
            return origWarn.apply(console, arguments);
        };
    }

    function generateList(chat, prompt, ok, fail) {
        if (_generating) return;
        _generating = true;
        Lampa.Noty.show(translate('ai_rec_loading'));
        callGemini(buildContents(chat, prompt), function (recs, model) {
            makeListState(recs, model, chat, function (state) {
                _generating = false;
                if (!state.items.length) return fail(translate('ai_rec_nothing'));
                ok(state);
            });
        }, function (message) {
            _generating = false;
            fail(message);
        });
    }

    function AiRecsComponent(object) {
        quietDeprecated();
        injectStyles();

        var comp = new Lampa.InteractionMain(object);
        var chat = null;
        var linesCount = 0;
        var builtStamp; /* chat.updated at build time - resume staleness check */

        function lineFor(state, title, kind, index) {
            var results = [];
            for (var i = 0; i < state.items.length && i < state.shown; i++) {
                results.push(cloneCard(state.items[i]));
            }
            return {
                title: title,
                results: results,
                nomore: true,
                ai_kind: kind,
                ai_index: index,
                ai_state: state,
                ai_chat: chat
            };
        }

        function buildLines() {
            var lines = [];
            if (chat.top && chat.top.items.length) {
                var topLine = lineFor(chat.top, escapeHtml(translate('ai_rec_top_title')), 'top');
                topLine.ai_refresh = refreshTop;
                lines.push(topLine);
            }
            for (var i = 0; i < chat.turns.length; i++) {
                var t = chat.turns[i];
                if (t.items.length) lines.push(lineFor(t, '&#128172; ' + escapeHtml(t.prompt), 'turn', i));
            }
            lines.push({
                title: '',
                results: [{ ai_input: true }],
                cardClass: function (element, params) { return new InputCard(element, params); },
                nomore: true,
                noimage: true,
                ai_kind: 'input'
            });
            linesCount = lines.length;
            builtStamp = chat.updated;
            comp.build(lines);

            if (_focusBottom) {
                _focusBottom = false;
                setTimeout(function () {
                    for (var d = 1; d < linesCount; d++) comp.down();
                }, 100);
            }
        }

        /* the response may arrive after the user navigated away - only
           rebuild when this page is still on screen (the saved chat is
           shown on the next open either way) */
        function pageStillActive() {
            var a = Lampa.Activity.active();
            return a && a.component === COMPONENT_NAME;
        }

        function refreshTop() {
            if (_generating) return;
            if (!geminiKey()) return Lampa.Noty.show(translate('ai_rec_no_key'));
            if (!favCards('like').length) Lampa.Noty.show(translate('ai_rec_no_likes'));
            comp.activity.loader(true);
            /* a detached context copy: the old top list is dropped from
               the conversation (a refresh may re-surface the best picks)
               without mutating the stored chat object */
            var ctx = { v: 1, top: null, turns: chat.turns };
            generateList(ctx, null, function (state) {
                chat.top = state;
                saveChat(chat);
                comp.activity.loader(false);
                if (pageStillActive()) Lampa.Activity.replace({});
            }, function (message) {
                comp.activity.loader(false);
                Lampa.Noty.show(message);
            });
        }

        function submitPrompt(text) {
            comp.activity.loader(true);
            generateList(chat, text, function (state) {
                chat.turns.push({
                    prompt: text,
                    ts: state.ts,
                    model: state.model,
                    items: state.items,
                    queue: state.queue,
                    shown: state.shown
                });
                saveChat(chat);
                comp.activity.loader(false);
                if (pageStillActive()) {
                    _focusBottom = true;
                    Lampa.Activity.replace({});
                }
            }, function (message) {
                comp.activity.loader(false);
                Lampa.Noty.show(message);
            });
        }

        function openPrompt() {
            Lampa.Input.edit({
                title: translate('ai_rec_prompt_title'),
                value: '',
                free: true,
                nosave: true
            }, function (text) {
                text = (text || '').replace(/^\s+|\s+$/g, '');
                /* Input.edit fires the callback on both enter and back -
                   an empty value means cancel either way */
                Lampa.Controller.toggle('content');
                if (!text) return;
                if (!geminiKey()) return Lampa.Noty.show(translate('ai_rec_no_key'));
                submitPrompt(text);
            });
        }

        comp.onAppend = function (item, element) {
            if (element.ai_kind === 'input') {
                item.onSelect = function () {
                    openPrompt();
                };
            }
        };

        /* a chat response that arrived while another page was on screen
           was saved but not rendered - rebuild when this page resumes */
        var origStart = comp.start;
        comp.start = function () {
            if (builtStamp !== undefined && !_generating) {
                var current = loadChat();
                if (current.updated !== undefined && current.updated !== builtStamp) {
                    chat = current;
                    return Lampa.Activity.replace({});
                }
            }
            return origStart.apply(comp, arguments);
        };

        comp.create = function () {
            this.activity.loader(true);
            chat = loadChat();

            if (chat.top && chat.top.items.length) return buildLines(); /* restore the session */

            if (!geminiKey()) {
                Lampa.Noty.show(translate('ai_rec_no_key'));
                return buildLines();
            }
            if (!favCards('like').length) {
                Lampa.Noty.show(translate('ai_rec_no_likes'));
                return buildLines();
            }

            generateList(chat, null, function (state) {
                chat.top = state;
                saveChat(chat);
                buildLines();
            }, function (message) {
                Lampa.Noty.show(message);
                buildLines();
            });
        };

        return comp;
    }

    /* one global 'line' listener serves every AI row: the More poster
       card (re-anchored to the end on every lazy card append) and the
       Refresh head button */
    function initLineHooks() {
        Lampa.Listener.follow('line', function (e) {
            if (e.type !== 'visible' && e.type !== 'append') return;
            if (!e.data || !e.data.ai_kind) return;

            if (e.data.ai_kind === 'top' || e.data.ai_kind === 'turn') {
                if (listHasMore(e.data.ai_state)) ensureMoreCard(e);
                /* the refresh closure travels on the line data - the
                   active-activity lookup is unreliable during the
                   synchronous restore build */
                if (e.data.ai_kind === 'top' && e.data.ai_refresh) {
                    appendRefreshButton(e, e.data.ai_refresh);
                }
            }
        });
    }

    /* ================================================================
     * 11. Head icon (after the search icon)
     * ================================================================ */

    var AI_ICON_SVG =
        '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M12 2.5l2.1 5.6 5.6 2.1-5.6 2.1L12 17.9l-2.1-5.6-5.6-2.1 5.6-2.1L12 2.5z" fill="currentColor"/>' +
        '<path d="M19.5 14.5l1 2.7 2.7 1-2.7 1-1 2.7-1-2.7-2.7-1 2.7-1 1-2.7z" fill="currentColor"/>' +
        '</svg>';

    function openAiPage() {
        if (!enabled()) return;
        Lampa.Activity.push({
            component: COMPONENT_NAME,
            title: translate('ai_rec_title'),
            source: 'tmdb',
            page: 1
        });
    }

    function initHeadIcon() {
        if (Lampa.Head.render().find('.open--ai-recs').length) return;

        var icon = Lampa.Head.addIcon(AI_ICON_SVG, openAiPage);
        icon.addClass('open--ai-recs');

        /* addIcon prepends - move it right after the search icon */
        var search = Lampa.Head.render().find('.open--search');
        if (search.length) icon.insertAfter(search.first());

        if (!enabled()) icon.addClass('hide');

        Lampa.Storage.listener.follow('change', function (e) {
            if (e.name !== 'ai_rec_enabled') return;
            Lampa.Head.render().find('.open--ai-recs').toggleClass('hide', !enabled());
        });
    }

    /* ================================================================
     * 12. Settings -> AI Recommendations
     * ================================================================ */

    function initSettings() {
        /* anchor below My Interface only when that plugin registered
           first - the settings menu silently drops items whose `after`
           target is not in the DOM yet (plugin load order varies) */
        var anchor = 'interface';
        try {
            var comps = Lampa.SettingsApi.allComponents();
            for (var k in comps) {
                if (k === 'my_interface' || (comps[k] && comps[k].component === 'my_interface')) anchor = 'my_interface';
            }
        } catch (e) {}

        Lampa.SettingsApi.addComponent({
            component: 'ai_recs',
            after: anchor,
            name: translate('ai_rec_title'),
            icon: AI_ICON_SVG
        });

        Lampa.SettingsApi.addParam({
            component: 'ai_recs',
            param: { name: 'ai_rec_enabled', type: 'trigger', default: true },
            field: { name: translate('ai_rec_enabled_name'), description: translate('ai_rec_enabled_descr') }
        });

        Lampa.SettingsApi.addParam({
            component: 'ai_recs',
            param: { name: 'ai_rec_gemini_key', type: 'input', values: '', placeholder: 'AIza... / AQ...', default: '' },
            field: { name: translate('ai_rec_gemini_key_name'), description: translate('ai_rec_gemini_key_descr') },
            onChange: function () { _stickyModel = null; }
        });

        Lampa.SettingsApi.addParam({
            component: 'ai_recs',
            param: {
                name: 'ai_rec_model',
                type: 'select',
                values: {
                    'auto': translate('ai_rec_model_auto'),
                    'gemini-2.5-pro': 'Gemini 2.5 Pro',
                    'gemini-2.5-flash': 'Gemini 2.5 Flash',
                    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
                    'gemini-2.0-flash': 'Gemini 2.0 Flash'
                },
                default: 'auto'
            },
            field: { name: translate('ai_rec_model_name'), description: translate('ai_rec_model_descr') },
            onChange: function () { _stickyModel = null; }
        });

        Lampa.SettingsApi.addParam({
            component: 'ai_recs',
            param: { type: 'button' },
            field: { name: translate('ai_rec_clear_name'), description: translate('ai_rec_clear_descr') },
            onChange: function () {
                clearChat();
                Lampa.Noty.show(translate('ai_rec_cleared'));
            }
        });
    }

    /* ================================================================
     * 13. Boot
     * ================================================================ */

    function safeInit(name, fn) {
        try { fn(); }
        catch (e) {
            console.error('AI Recommendations:', name, 'init failed -', e && e.stack ? e.stack : e);
        }
    }

    function startPlugin() {
        console.log('AI Recommendations', PLUGIN_VERSION, 'loaded');

        Lampa.Manifest.plugins = {
            type: 'other',
            version: PLUGIN_VERSION,
            name: translate('ai_rec_title'),
            description: translate('ai_rec_settings_descr'),
            component: COMPONENT_NAME
        };

        safeInit('settings', initSettings);
        safeInit('component', function () {
            Lampa.Component.add(COMPONENT_NAME, AiRecsComponent);
            Lampa.Component.add(LIST_COMPONENT_NAME, AiListComponent);
        });
        safeInit('line-hooks', initLineHooks);
        safeInit('head-icon', initHeadIcon);
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
