import { render } from 'preact';
import { App } from './app';
import 'highlight.js/styles/github-dark.css';
import './styles.css';

const root = document.getElementById('app');
if (root) render(<App />, root);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Офлайн-режим не критичен для работы приложения.
    });
  });
}
