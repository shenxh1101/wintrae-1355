import { useEffect } from 'react';
import { useStore } from '../store';
import type { AppState } from '@shared/types';

const STORAGE_KEY = 'podcast-studio-state';

export function usePersistence() {
  const episodes = useStore((s) => s.episodes);
  const templates = useStore((s) => s.templates);
  const currentEpisodeId = useStore((s) => s.currentEpisodeId);
  const exportRecords = useStore((s) => s.exportRecords);
  const loadFromStorage = useStore((s) => s.loadFromStorage);

  useEffect(() => {
    (async () => {
      try {
        if (window.electronAPI) {
          const dataPath = await window.electronAPI.getDataPath();
          const filePath = `${dataPath}\\${STORAGE_KEY}.json`;
          const exists = await window.electronAPI.fileExists(filePath);
          if (exists) {
            const raw = await window.electronAPI.readFile(filePath);
            const data = JSON.parse(raw) as AppState;
            if (data.episodes && data.episodes.length > 0) {
              loadFromStorage(data);
              return;
            }
          }
        } else {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const data = JSON.parse(raw) as AppState;
            if (data.episodes && data.episodes.length > 0) {
              loadFromStorage(data);
              return;
            }
          }
        }
      } catch (e) {
        console.error('Failed to load state from storage:', e);
      }
    })();
  }, [loadFromStorage]);

  useEffect(() => {
    const saveTimeout = setTimeout(async () => {
      try {
        const state: AppState = { currentEpisodeId, episodes, templates, exportRecords };
        const json = JSON.stringify(state, null, 2);
        if (window.electronAPI) {
          const dataPath = await window.electronAPI.getDataPath();
          const filePath = `${dataPath}\\${STORAGE_KEY}.json`;
          await window.electronAPI.writeFile(filePath, json);
        } else {
          localStorage.setItem(STORAGE_KEY, json);
        }
      } catch (e) {
        console.error('Failed to save state to storage:', e);
      }
    }, 500);
    return () => clearTimeout(saveTimeout);
  }, [episodes, templates, currentEpisodeId, exportRecords]);
}
