(() => {
    'use strict';

    const trigger = document.querySelector('.social-wrap a[href$="#contact-dialog"]');
    if (!trigger) return;

    const dialog = document.createElement('dialog');
    dialog.id = 'contact-dialog';
    dialog.className = 'contact-dialog';
    dialog.setAttribute('aria-labelledby', 'contact-dialog-title');
    dialog.innerHTML = `
        <div class="contact-dialog-header">
            <h2 id="contact-dialog-title">联系方式</h2>
            <button class="contact-dialog-close" type="button" aria-label="关闭联系方式" autofocus>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M6 18L18 6"/>
                </svg>
            </button>
        </div>
        <div class="contact-phone">
            <span>手机号码</span>
            <a href="tel:16655832601">16655832601</a>
        </div>
        <div class="contact-qr-grid">
            <figure class="contact-qr">
                <figcaption>微信二维码</figcaption>
                <a href="/assets/pic/wechat.png" target="_blank" rel="noopener noreferrer" aria-label="查看微信二维码原图">
                    <img src="/assets/pic/wechat.png" alt="小张同学的微信二维码" decoding="async">
                </a>
            </figure>
            <figure class="contact-qr">
                <figcaption>QQ 二维码</figcaption>
                <a href="/assets/pic/QQ.png" target="_blank" rel="noopener noreferrer" aria-label="查看 QQ 二维码原图">
                    <img src="/assets/pic/QQ.png" alt="小张同学的 QQ 二维码" decoding="async">
                </a>
            </figure>
        </div>
        <p class="contact-dialog-hint">点击二维码可查看原图</p>
    `;
    document.body.appendChild(dialog);

    trigger.setAttribute('role', 'button');
    trigger.setAttribute('aria-label', '联系方式');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);

    const openDialog = () => {
        if (dialog.open) return;
        dialog.showModal();
        document.documentElement.classList.add('contact-dialog-open');
    };

    trigger.addEventListener('click', event => {
        event.preventDefault();
        openDialog();
    });

    trigger.addEventListener('keydown', event => {
        if (event.key === ' ') {
            event.preventDefault();
            openDialog();
        }
    });

    dialog.querySelector('.contact-dialog-close').addEventListener('click', () => dialog.close());

    dialog.addEventListener('click', event => {
        const bounds = dialog.getBoundingClientRect();
        const outside = event.clientX < bounds.left || event.clientX > bounds.right
            || event.clientY < bounds.top || event.clientY > bounds.bottom;
        if (event.target === dialog && outside) dialog.close();
    });

    dialog.addEventListener('close', () => {
        document.documentElement.classList.remove('contact-dialog-open');
        trigger.focus({ preventScroll: true });
    });
})();
