const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

function base64ToFile(base64, fileName, mimeType) {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeType });
  return new File([blob], fileName, { type: mimeType });
}

export async function saveCache(tab, { file, result, selectedMatter }) {
  const key = `poc_cache_${tab}`;
  try {
    const entry = { result, selectedMatter: selectedMatter || null };

    if (file && file.size <= MAX_FILE_SIZE_BYTES) {
      const base64 = await fileToBase64(file);
      entry.file = {
        name: file.name,
        type: file.type,
        base64,
      };
    }

    localStorage.setItem(key, JSON.stringify(entry));
  } catch (err) {
    console.warn(`[cache] Failed to save ${tab} cache:`, err.message);
  }
}

export function loadCache(tab) {
  const key = `poc_cache_${tab}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    let file = null;
    let previewUrl = null;

    if (entry.file?.base64) {
      file = base64ToFile(entry.file.base64, entry.file.name, entry.file.type);
      const blob = new Blob(
        [Uint8Array.from(atob(entry.file.base64), (c) => c.charCodeAt(0))],
        { type: entry.file.type }
      );
      previewUrl = URL.createObjectURL(blob);
    }

    return {
      file,
      previewUrl,
      result: entry.result || null,
      selectedMatter: entry.selectedMatter || null,
    };
  } catch (err) {
    console.warn(`[cache] Failed to load ${tab} cache:`, err.message);
    return null;
  }
}
