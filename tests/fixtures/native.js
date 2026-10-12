'use strict';
window.nativeActions = { votes: 0, replies: 0, submits: 0, sorts: 0 };
document.querySelectorAll('.menu-item').forEach(node => node.addEventListener('click', () => {
  if (node.title === '回复') { window.nativeActions.replies++; document.querySelector('#editor textarea')?.focus(); }
  else if (node.title === '点赞') window.nativeActions.votes++;
}));
document.querySelector('.submit')?.addEventListener('click', () => { window.nativeActions.submits++; });
document.querySelectorAll('.sorter a').forEach(node => node.addEventListener('click', () => {
  window.nativeActions.sorts++; document.querySelectorAll('.sorter a').forEach(a => a.classList.remove('selected')); node.classList.add('selected');
}));

// Native forum image viewer fixture: delegation also covers dynamically imported images.
document.addEventListener('click', event => {
  const image=event.target.closest?.('.post-content img:not(.sticker)'); if(!image || image.closest('a')) return;
  const overlay=document.createElement('div'); overlay.id='native-image-viewer'; overlay.setAttribute('role','dialog');
  overlay.style.cssText='position:fixed;inset:0;z-index:9000;background:#000b';
  const close=document.createElement('button');close.textContent='关闭原站图片';overlay.append(close);document.body.append(overlay);close.focus();
  const dismiss=()=>{overlay.remove();document.removeEventListener('keydown',keys);image.focus();};
  const keys=e=>{if(e.key==='Escape')dismiss();};close.addEventListener('click',dismiss);document.addEventListener('keydown',keys);
});
