import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useAppStore = create(devtools(
  (set, get) => ({
    // --- Auth ---
    user: null,
    token: null,
    setAuth: (user, token) => {
      localStorage.setItem('mosaic_token', token);
      set({ user, token });
    },
    clearAuth: () => {
      localStorage.removeItem('mosaic_token');
      set({ user: null, token: null });
    },

    // --- Flow ---
    activeTab: 'generate',
    setActiveTab: (tab) => set({ activeTab: tab }),
    completedSteps: [],
    markStepComplete: (step) => set(s => ({
      completedSteps: s.completedSteps.includes(step)
        ? s.completedSteps
        : [...s.completedSteps, step],
    })),

    // --- Generation ---
    generatedImages: [],
    selectedImageId: null,
    isGenerating: false,
    setGeneratedImages: (images) => set({ generatedImages: images }),
    addGeneratedImages: (images) => set(s => ({ generatedImages: [...s.generatedImages, ...images] })),
    setSelectedImageId: (id) => set({ selectedImageId: id }),
    setIsGenerating: (v) => set({ isGenerating: v }),
    replaceImage: (id, newImage) => set(s => ({
      generatedImages: s.generatedImages.map(img => img.id === id ? { ...img, ...newImage } : img),
    })),

    // --- Captions ---
    caption: '',
    hashtags: [],
    captionPlatform: 'instagram',
    captionTone: 'casual',
    setCaption: (caption) => set({ caption }),
    setHashtags: (hashtags) => set({ hashtags }),
    setCaptionPlatform: (p) => set({ captionPlatform: p }),
    setCaptionTone: (t) => set({ captionTone: t }),

    // --- Social ---
    connections: [],
    setConnections: (connections) => set({ connections }),

    // --- Publish ---
    scheduledPosts: [],
    publishHistory: [],
    setScheduledPosts: (posts) => set({ scheduledPosts: posts }),
    setPublishHistory: (history) => set({ publishHistory: history }),

    // --- Derived ---
    getSelectedImage: () => {
      const { generatedImages, selectedImageId } = get();
      return generatedImages.find(img => img.id === selectedImageId) ?? null;
    },
  }),
  { name: 'MosaicManageStore' }
));

export default useAppStore;
