import type { ComponentType } from "react";

type RemoteModule = { default: ComponentType };

type Factory = () => any;
interface Container {
  init: (shareScope: any) => Promise<void>;
  get: (module: string) => Promise<Factory>;
}

const scriptCache = new Map<string, Promise<any>>();

export function loadDynamicRemote(remoteName: string, moduleName: string): () => Promise<RemoteModule> {
  return () => {
    const url = window.MFE_CONFIG?.[remoteName];
    if (!url) {
      return Promise.reject(new Error(`URL for remote "${remoteName}" not found in runtime config`));
    }

    if (!scriptCache.has(url)) {
      const loadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`);
        
        if (existing) {
            existing.addEventListener('load', () => resolve(true));
            existing.addEventListener('error', () => reject(new Error(`Network error while loading script: ${url}`)));
            return;
        }

        const script = document.createElement('script');
        script.src = url;
        script.type = 'text/javascript';
        script.async = true;

        script.onload = () => resolve(true);
        script.onerror = () => {
          script.remove(); 
          scriptCache.delete(url); 
          reject(new Error(`Network error while loading script: ${url}`));
        };

        document.head.appendChild(script);
      });

      scriptCache.set(url, loadPromise);
    }

    return scriptCache.get(url)!.then(async () => {
      const container = (window as any)[remoteName] as Container;
      
      if (!container) {
        scriptCache.delete(url);
        throw new Error(`Remote container "${remoteName}" is missing on window object`);
      }

      try {
        await __webpack_init_sharing__('default');
        await container.init(__webpack_share_scopes__.default);
      } catch (e) {
        console.warn(`[MFE] Share scope init for "${remoteName}":`, e);
      }

      const factory = await container.get(moduleName);
      return factory();
    });
  };
}
