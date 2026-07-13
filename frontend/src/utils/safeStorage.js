const memoryStore = {};

const safeStorage = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn("Storage access blocked by browser settings, falling back to memory:", e);
      return memoryStore[key] || null;
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage access blocked by browser settings, falling back to memory:", e);
      memoryStore[key] = String(value);
    }
  },
  removeItem: (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn("Storage access blocked by browser settings, falling back to memory:", e);
      delete memoryStore[key];
    }
  },
  clear: () => {
    try {
      window.localStorage.clear();
    } catch (e) {
      console.warn("Storage access blocked by browser settings, falling back to memory:", e);
      for (const key in memoryStore) {
        delete memoryStore[key];
      }
    }
  }
};

export default safeStorage;
