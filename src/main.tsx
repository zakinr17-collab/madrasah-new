import './securityConsoleGuard.js';
import './realtimeExamSnapshotGuard.js';

// Robust fetch response .json() fallback for non-JSON or HTML responses
const originalFetchJson = Response.prototype.json;
Response.prototype.json = async function () {
  const clone = this.clone();
  try {
    return await originalFetchJson.call(this);
  } catch (err) {
    const text = await clone.text().catch(() => "");
    console.warn("Caught non-JSON response in fetch .json():", text);
    const cleanMsg = text && text.length < 200 && !text.includes("<html") ? text : "Gagal memproses respon server. Silakan coba kembali.";
    return { success: false, message: cleanMsg };
  }
};

import '@fortawesome/fontawesome-free/css/all.min.css';
import 'katex/dist/katex.min.css';
import './index.css';
import './appScript.js';
import './modulesScript.js';
import './adminModules.js';
import './credentialVisibilityPatch.js';
import './cbtModules.js';
import './questionConverterTypeFix.js';
import './pedagogyNonAIEngine.js';
import './modulAjarModule.js';
import './settingsAndMisc.js';
import './themePackageModule.js';
import './themeEngineV2.js';
import './assessmentModule.js';
import './chatModule.js';
import './chatAttachmentUiFix.js';
import './studentDirectChat.js';
import './calendarModule.js';
import './bossModule.js';
import './gameModule.js';
import './gameArenaPublishGuard.js';
import './gameArenaLayoutGuard.js';
import './lkpdModule.js';
import './learningModule.js';
import './operationsCenter.js';

// Smoothly dismiss the initial preloader once all styles and scripts are loaded
function removeInitialPreloader() {
  const preloader = document.getElementById('app-initial-loader');
  if (preloader) {
    preloader.classList.add('loaded');
    setTimeout(() => {
      try { preloader.remove(); } catch (_) {}
    }, 400);
  }
}

let runtimeReadySeen = Boolean((window as any).__onlineRuntimeReady);

function dismissPreloaderWhenReady() {
  runtimeReadySeen = true;
  removeInitialPreloader();
}

window.addEventListener('madrasah:runtime-ready', dismissPreloaderWhenReady, { once: true });

if (runtimeReadySeen) {
  requestAnimationFrame(removeInitialPreloader);
}

// Do not keep the user behind the splash screen forever if Cloud SQL needs longer.
// Session/login requests are still guarded separately until /readyz reports ready.
setTimeout(() => {
  if (!runtimeReadySeen) removeInitialPreloader();
}, 6000);
