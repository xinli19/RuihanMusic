(function () {
    function debounce(fn, delay) {
        let timer = null;
        return (...args) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn.apply(null, args), delay);
        };
    }

    function resolveEl(selOrEl) {
        if (!selOrEl) return null;
        if (typeof selOrEl === 'string') return document.querySelector(selOrEl);
        return selOrEl;
    }

    // 全局可用：window.createSearchBar
    window.createSearchBar = function createSearchBar(options) {
        const {
            inputSelector,
            buttonSelector,
            resultContainerSelector,
            minChars = 1,
            debounceMs = 300,
            // 必填：返回 Promise<array>
            search,
            // 必填：根据数组返回 innerHTML 字符串
            renderItems,
            // 可选：渲染后进行事件绑定（如按钮点击）
            onBind,
            // 可配空态/错误态
            emptyHtml = '<div class="empty-state" style="padding:8px;color:#666;">未找到匹配结果</div>',
            errorHtml = '<div class="empty-state" style="padding:8px;color:#c00;">搜索失败，请稍后重试</div>',
        } = options || {};

        const input = resolveEl(inputSelector);
        const btn = resolveEl(buttonSelector);
        const box = resolveEl(resultContainerSelector);

        if (!input || !box) {
            return { destroy() {} };
        }

        function render(list) {
            box.style.display = 'block';
            if (!Array.isArray(list) || list.length === 0) {
                box.innerHTML = emptyHtml;
                return;
            }
            box.innerHTML = renderItems(list);
            if (typeof onBind === 'function') {
                onBind(box);
            }
        }

        async function doSearch() {
            const q = (input.value || '').trim();
            if (q.length < minChars) {
                box.innerHTML = '';
                box.style.display = 'none';
                return;
            }
            try {
                const items = await search(q);
                render(items || []);
            } catch (e) {
                box.style.display = 'block';
                box.innerHTML = errorHtml;
            }
        }

        const onInput = debounce(doSearch, debounceMs);
        input.addEventListener('input', onInput);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                doSearch();
            }
        });
        if (btn) btn.addEventListener('click', doSearch);

        return {
            search: doSearch,
            destroy() {
                input.removeEventListener('input', onInput);
            }
        };
    };
})();