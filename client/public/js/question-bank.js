(function () {
    'use strict';
    const form = document.querySelector('#question-editor');
    if (!form) return;
    const message = document.querySelector('#bank-message');
    const cardSelect = document.querySelector('#question-card');
    const filter = document.querySelector('#bank-filter');
    const list = document.querySelector('#question-list');
    const showArchived = document.querySelector('#show-archived');
    const save = document.querySelector('#save-question');
    let editing = null;
    let questions = [];
    let busy = false;

    function reset() {
        editing = null;
        form.reset();
        document.querySelector('#editor-title').textContent = 'Add a question';
    }
    function render() {
        list.replaceChildren();
        const visible = questions.filter(q => (!filter.value || q.card_id === Number(filter.value)) && (q.is_active || showArchived.checked));
        document.querySelector('#bank-count').textContent = visible.length + ' question(s). Changes apply to future card selections.';
        visible.forEach(question => {
            const article = document.createElement('article');
            article.className = 'card';
            const title = document.createElement('h3');
            title.textContent = question.card_name + ' — ' + question.topic + (question.is_active ? '' : ' (archived)');
            const text = document.createElement('pre');
            text.className = 'code-block';
            text.style.whiteSpace = 'pre-wrap';
            text.textContent = question.question_text;
            article.append(title, text);
            question.options.forEach(option => {
                const line = document.createElement('p');
                line.textContent = option.option_label + ': ' + option.option_text + (option.is_correct ? ' ✓ Correct' : '');
                article.append(line);
            });
            const explanation = document.createElement('p');
            explanation.textContent = 'Explanation: ' + (question.explanation || '—');
            article.append(explanation);
            const edit = document.createElement('button');
            edit.type = 'button'; edit.className = 'btn btn-small'; edit.textContent = 'Edit'; edit.disabled = busy || !question.is_active;
            edit.addEventListener('click', () => {
                editing = question.question_id;
                cardSelect.value = question.card_id;
                form.elements.topic.value = question.topic;
                form.elements.question_text.value = question.question_text;
                form.elements.explanation.value = question.explanation || '';
                question.options.forEach(option => {
                    form.elements['option_' + option.option_label].value = option.option_text;
                    if (option.is_correct) form.elements.correct.value = option.option_label;
                });
                document.querySelector('#editor-title').textContent = 'Edit question #' + editing + ' (saves a new version)';
                form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            const status = document.createElement('button');
            status.type = 'button'; status.className = 'btn btn-small btn-pink'; status.textContent = question.is_active ? 'Archive' : 'Activate'; status.disabled = busy;
            status.addEventListener('click', async () => {
                if (!window.confirm((question.is_active ? 'Archive' : 'Activate') + ' this question?')) return;
                await mutate('PATCH', '/api/questions/manage/' + question.question_id + '/status', { is_active: !question.is_active });
            });
            const remove = document.createElement('button');
            remove.type = 'button'; remove.className = 'btn btn-small btn-pink'; remove.textContent = 'Delete'; remove.disabled = busy;
            remove.addEventListener('click', async () => {
                if (!window.confirm('Permanently delete this question and all four answer options? This cannot be undone. Questions used in game history or an open turn cannot be deleted; archive them instead.')) return;
                await mutate('DELETE', '/api/questions/manage/' + question.question_id);
            });
            article.append(edit, status, remove);
            list.append(article);
        });
    }
    async function load() {
        const result = await FJ.sendJson('GET', '/api/questions/manage');
        if (!result.ok) throw new Error(result.data && result.data.message || 'Could not load questions. Sign in as a lecturer.');
        questions = result.data.questions;
        if (!cardSelect.options.length) result.data.cards.forEach(card => {
            const option = document.createElement('option');
            option.value = card.card_id; option.textContent = card.card_name + (card.difficulty ? ' (' + card.difficulty + ')' : '');
            filter.append(option.cloneNode(true));
            if (card.is_active) cardSelect.append(option);
        });
        render();
    }
    async function mutate(method, url, body) {
        if (busy) return;
        busy = true; save.disabled = true; render();
        try {
            const result = await FJ.sendJson(method, url, body);
            if (!result.ok) throw new Error(result.data && result.data.message || 'Could not save changes.');
            reset();
            await load();
            FJ.showMessage(message, result.data.message, 'success');
        } catch (error) { FJ.showMessage(message, error.message, 'error'); }
        finally { busy = false; save.disabled = false; render(); }
    }
    form.addEventListener('submit', event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const body = {
            card_id: Number(cardSelect.value), topic: form.elements.topic.value,
            question_text: form.elements.question_text.value, explanation: form.elements.explanation.value,
            options: ['A', 'B', 'C', 'D'].map(label => ({ option_label: label,
                option_text: form.elements['option_' + label].value, is_correct: form.elements.correct.value === label }))
        };
        mutate(editing ? 'PUT' : 'POST', '/api/questions/manage' + (editing ? '/' + editing : ''), body);
    });
    document.querySelector('#cancel-edit').addEventListener('click', () => { if (!busy) reset(); });
    filter.addEventListener('change', render);
    showArchived.addEventListener('change', render);
    load().catch(error => { save.disabled = true; FJ.showMessage(message, error.message, 'error'); });
})();
