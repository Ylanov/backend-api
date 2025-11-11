// src/lib/ymaps.ts
declare global {
  interface Window {
    ymaps?: any;
  }
}

let loadingPromise: Promise<any> | null = null;

/**
 * Загружает Yandex Maps JS API один раз и возвращает window.ymaps.
 * Повторные вызовы вернут тот же промис / инстанс.
 */
export function loadYMaps(apiKey: string): Promise<any> {
  if (window.ymaps) {
    return Promise.resolve(window.ymaps);
  }
  if (loadingPromise) {
    return loadingPromise;
  }

  const existing = document.getElementById("ymaps-sdk");
  if (existing) {
    // скрипт уже вставлен — ждём готовности
    loadingPromise = new Promise((resolve, reject) => {
      (window as any).ymaps
        ? (window as any).ymaps.ready(() => resolve(window.ymaps))
        : existing.addEventListener("load", () => resolve(window.ymaps));
      existing.addEventListener("error", () => reject(new Error("Failed to load Yandex Maps script")));
    });
    return loadingPromise;
  }

  const script = document.createElement("script");
  script.id = "ymaps-sdk";
  script.src = `https://api-maps.yandex.ru/2.1/?lang=ru_RU&apikey=${apiKey}`;
  script.async = true;

  loadingPromise = new Promise((resolve, reject) => {
    script.onload = () => {
      if (!window.ymaps) {
        reject(new Error("Yandex Maps loaded but window.ymaps is undefined"));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps));
    };
    script.onerror = () => reject(new Error("Failed to load Yandex Maps script"));
  });

  document.head.appendChild(script);
  return loadingPromise;
}
