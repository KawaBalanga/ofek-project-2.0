import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, Search, Edit2, Trash2, Plus, Loader2, ShoppingBag, ShoppingCart, Minus, Trash, Download, FileText, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';

interface ServerImage {
  id: string;
  title: string;
  filename: string;
  tags: string[];
}

interface ClothingItem {
  id: string;
  title: string;
  representativeImage: string;
  images: { id: string, url: string }[];
  tags: string[];
}

const ALLOWED_TAGS = ['Shirt', 'Pants', 'Skirt', 'Top', 'Dress', 'Bodysuit', 'Jacket'];
const SIZES = ['S', 'M', 'L', 'XL'] as const;
type Size = typeof SIZES[number];

export default function App() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [nextCollectionNumber, setNextCollectionNumber] = useState('001');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [currentFilter, setCurrentFilter] = useState('all');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<ClothingItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cart, setCart] = useState<{ item: ClothingItem; quantity: number; size: Size; imageUrl?: string }[]>([]);
  const [selectedSize, setSelectedSize] = useState<Size>('M');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [addingImageToId, setAddingImageToId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const collectionFileInputRef = useRef<HTMLInputElement>(null);
  const billRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isUploadModalOpen) {
      let maxNum = 0;
      items.forEach(item => {
        const num = parseInt(item.title);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      });
      const nextNum = (maxNum + 1).toString().padStart(3, '0');
      setNextCollectionNumber(nextNum);
      setTitle(nextNum);
    }
  }, [isUploadModalOpen, items]);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/images');
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setItems(data);
      
      let maxNum = 0;
      data.forEach((item: ClothingItem) => {
        const num = parseInt(item.title);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      });
      const nextNum = (maxNum + 1).toString().padStart(3, '0');
      setNextCollectionNumber(nextNum);
    } catch (err: any) {
      console.error("Error fetching items:", err);
      setError(err.message || "Failed to load collection. Please check your Cloudinary configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) return alert("Please select images!");
    
    setUploading(true);
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    try {
      const newImages: ServerImage[] = [];
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('title', title || "Unnamed");
        formData.append('batchId', batchId);
        formData.append('tags', Array.from(selectedTags).join(','));
        formData.append('image', file);
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `Upload failed with status ${res.status}`);
        }

        const data = await res.json();
        if (data.success && data.file) {
          newImages.push(data.file);
        }
      }
      
      // Immediately update state with a temporary collection
      if (newImages.length > 0) {
        const tempCollection: ClothingItem = {
          id: batchId,
          title: title || "Unnamed",
          representativeImage: newImages[0].filename,
          images: newImages.map(item => ({ id: item.id, url: item.filename })),
          tags: Array.from(selectedTags)
        };
        setItems(prev => [tempCollection, ...prev]);
      }
      
      setTitle('');
      setSelectedTags(new Set());
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsUploadModalOpen(false);
      
      // Sync in background after a short delay
      setTimeout(fetchItems, 3000);
    } catch (err: any) {
      console.error("Upload error:", err);
      alert(`Upload failed: ${err.message || "An unknown error occurred"}`);
    } finally {
      setUploading(false);
    }
  };

  const toggleTag = (tag: string, set: Set<string>, setter: (s: Set<string>) => void) => {
    const newSet = new Set(set);
    if (newSet.has(tag)) newSet.delete(tag);
    else newSet.add(tag);
    setter(newSet);
  };

  const handleAddToCollection = async (event: React.ChangeEvent<HTMLInputElement>, collection: ClothingItem) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newImages: { id: string, url: string }[] = [];
      for (const file of Array.from(files) as File[]) {
        const formData = new FormData();
        formData.append('title', collection.title);
        formData.append('batchId', collection.id);
        formData.append('tags', collection.tags.join(','));
        formData.append('image', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json();
        if (data.success && data.file) {
          newImages.push({ id: data.file.id, url: data.file.filename });
        }
      }

      // Update local state
      const updatedCollection = {
        ...collection,
        images: [...collection.images, ...newImages]
      };
      
      setItems(prev => prev.map(item => item.id === collection.id ? updatedCollection : item));
      setSelectedCollection(updatedCollection);
      
      if (collectionFileInputRef.current) collectionFileInputRef.current.value = '';
      
      // Sync in background
      setTimeout(fetchItems, 2000);
    } catch (err: any) {
      console.error("Add to collection error:", err);
      alert(`Upload failed: ${err.message || "An unknown error occurred"}`);
    } finally {
      setUploading(false);
    }
  };



  const handleDeleteCollection = async (collection: ClothingItem) => {
    if (!confirm(`Are you sure you want to delete the entire collection "${collection.title}"?`)) return;
    
    setUploading(true);
    try {
      // Use for...of to allow better error handling or sequencing if needed
      // Though Promise.all is fine if we don't mind parallel fails
      const results = await Promise.all(
        collection.images.map(img => 
          fetch(`/api/delete-image?id=${encodeURIComponent(img.id)}`, { method: 'DELETE' })
            .then(res => res.ok || res.status === 404) // Count 404 as success for deletion
        )
      );

      const allSuccessful = results.every(success => success);
      
      // Update local state regardless for immediate feedback
      setItems(prev => prev.filter(item => item.id !== collection.id));
      setDeletingId(null);
      setSelectedCollection(null);
      
      if (!allSuccessful) {
        console.warn("Some images might not have been fully removed from Cloudinary, but the collection is removed from the app.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error: Some images could not be deleted from the server.");
      // Still remove locally to stop annoying the user
      setItems(prev => prev.filter(item => item.id !== collection.id));
      setDeletingId(null);
      setSelectedCollection(null);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateTags = async (collection: ClothingItem) => {
    try {
      const publicIds = collection.images.map(img => img.id);
      const res = await fetch('/api/update-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicIds, tags: Array.from(editTags) }),
      });

      if (res.ok) {
        setEditingId(null);
        fetchItems();
      } else {
        alert("Failed to update tags.");
      }
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const cartIconRef = useRef<HTMLButtonElement>(null);
  const [flyingItems, setFlyingItems] = useState<{ id: number; startX: number; startY: number; image: string }[]>([]);
  
  useEffect(() => {
    if (!selectedCollection) {
      setSelectedQuantity(1);
      setSelectedSize('M');
      setActiveImageIndex(0);
    }
  }, [selectedCollection]);

  const addToCart = (item: ClothingItem, event: React.MouseEvent, size: Size, quantity: number = 1, imageOverride?: string) => {
    // Fly animation logic
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const newItem = {
      id: Date.now(),
      startX: rect.left + rect.width / 2,
      startY: rect.top + rect.height / 2,
      image: imageOverride || item.representativeImage
    };
    setFlyingItems(prev => [...prev, newItem]);
    setTimeout(() => {
      setFlyingItems(prev => prev.filter(i => i.id !== newItem.id));
    }, 800);

    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id && i.size === size);
      if (existing) {
        return prev.map(i => (i.item.id === item.id && i.size === size) ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { item, quantity, size, imageUrl: imageOverride }];
    });
  };

  const removeFromCart = (id: string, size: Size) => {
    setCart(prev => prev.filter(i => !(i.item.id === id && i.size === size)));
  };

  const updateQuantity = (id: string, size: Size, value: number, isAbsolute: boolean = false) => {
    setCart(prev => prev.map(i => {
      if (i.item.id === id && i.size === size) {
        const newQty = isAbsolute ? Math.max(1, value) : Math.max(1, i.quantity + value);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const cartTotalItems = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  const downloadBill = async () => {
    if (!billRef.current) return;
    setIsDownloading(true);
    try {
      // Ensure the capture captures the full content
      const element = billRef.current;
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: element.offsetWidth,
        height: element.offsetHeight,
        onclone: (doc) => {
          // Force standard colors on the cloned element to avoid oklab/oklch errors in html2canvas
          const receipt = doc.querySelector('.receipt-paper') as HTMLElement;
          if (receipt) {
            receipt.style.backgroundColor = '#ffffff';
            receipt.style.color = '#000000';
            receipt.style.borderRadius = '0';
            
            // Fix all text and borders to standard colors
            const allElements = receipt.querySelectorAll('*');
            allElements.forEach((el) => {
              const htmlEl = el as HTMLElement;
              const style = window.getComputedStyle(htmlEl);
              if (style.color.includes('okl')) htmlEl.style.color = '#000000';
              if (style.backgroundColor.includes('okl')) htmlEl.style.backgroundColor = 'transparent';
              if (style.borderColor.includes('okl')) htmlEl.style.borderColor = '#eeeeee';
            });
          }
        }
      });
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = dataUrl;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `collection-receipt-${dateStr}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to generate the receipt image. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const itemTags = item.tags.filter(t => ALLOWED_TAGS.includes(t));
    const search = searchTerm.toLowerCase();
    
    // Category filter
    let matchesFilter = true;
    if (currentFilter === 'untagged') matchesFilter = itemTags.length === 0;
    else if (currentFilter !== 'all') matchesFilter = itemTags.some(t => t.toLowerCase() === currentFilter.toLowerCase());

    // Search query
    const matchesSearch = item.id.toLowerCase().includes(search) || 
                          item.tags.some(t => t.toLowerCase().includes(search)) ||
                          item.title.toLowerCase().includes(search);

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-white text-black font-sans pb-20 relative">
      {/* Collection Details Modal */}
      <AnimatePresence>
        {selectedCollection && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCollection(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[150]"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed inset-0 m-auto h-[90vh] max-w-7xl w-[95vw] z-[160] bg-white shadow-2xl rounded-sm overflow-hidden flex flex-col md:flex-row"
            >
              <button 
                onClick={() => setSelectedCollection(null)}
                className="absolute top-6 right-6 z-20 p-2 bg-white/50 backdrop-blur-md rounded-full hover:bg-white hover:rotate-90 transition-all"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Left: Interactive Image Gallery */}
              <div className="flex-[2] bg-gray-50 flex flex-col relative overflow-hidden group/gallery">
                <div className="flex-1 flex items-center justify-center p-12 relative">
                  <AnimatePresence mode='wait'>
                    <motion.div
                      key={selectedCollection.images[activeImageIndex]?.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.4 }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      <img 
                        src={selectedCollection.images[activeImageIndex]?.url} 
                        alt={selectedCollection.title}
                        className="max-w-full max-h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
                      />
                    </motion.div>
                  </AnimatePresence>

                  {/* Nav Arrows */}
                  {selectedCollection.images.length > 1 && (
                    <>
                      <button 
                        onClick={() => setActiveImageIndex(i => (i - 1 + selectedCollection.images.length) % selectedCollection.images.length)}
                        className="absolute left-8 top-1/2 -translate-y-1/2 p-3 bg-white/80 backdrop-blur-md rounded-full shadow-lg opacity-0 group-hover/gallery:opacity-100 transition-all hover:bg-black hover:text-white"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button 
                        onClick={() => setActiveImageIndex(i => (i + 1) % selectedCollection.images.length)}
                        className="absolute right-8 top-1/2 -translate-y-1/2 p-3 bg-white/80 backdrop-blur-md rounded-full shadow-lg opacity-0 group-hover/gallery:opacity-100 transition-all hover:bg-black hover:text-white"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnails Section */}
                <div className="p-6 bg-white border-t border-gray-100">
                  <div className="flex gap-4 overflow-x-auto pb-2 px-2 scrollbar-hide">
                    {selectedCollection.images.map((img, idx) => (
                      <div key={img.id} className="relative shrink-0">
                        <button 
                          onClick={() => setActiveImageIndex(idx)}
                          className={`w-20 h-24 bg-gray-50 rounded-sm overflow-hidden border-2 transition-all ${
                            activeImageIndex === idx ? 'border-black scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={img.url} className="w-full h-full object-cover" alt="thumb" />
                        </button>
                      </div>
                    ))}
                    
                    <button 
                      onClick={() => collectionFileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-20 h-24 border-2 border-dashed border-gray-200 rounded-sm flex flex-col items-center justify-center gap-1 hover:border-black/30 hover:bg-gray-50 transition-all shrink-0"
                    >
                      <Plus className="h-4 w-4 text-gray-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Add</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Right: Details & Operations */}
              <div className="flex-1 flex flex-col bg-white overflow-y-auto">
                <div className="p-12 space-y-12">
                  <div>
                    <div className="inline-block px-2 py-0.5 border border-black mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest leading-none">Studio Archive</p>
                    </div>
                    <h2 className="text-4xl font-bold uppercase tracking-[0.15em] leading-tight">{selectedCollection.title}</h2>
                    <p className="text-[11px] text-gray-400 font-mono tracking-widest uppercase mt-3">ID: {selectedCollection.id.substr(0, 16)}</p>
                  </div>

                  <div className="space-y-6">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-gray-300 font-mono">Classification</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedCollection.tags.filter(t => ALLOWED_TAGS.includes(t)).map(tag => (
                        <span key={tag} className="px-4 py-2 border border-gray-100 text-[11px] uppercase font-bold tracking-widest text-black bg-gray-50">
                          {tag}
                        </span>
                      )) || <span className="text-gray-300 uppercase text-[10px] tracking-widest">Unclassified</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-300 font-mono">Dimensions</p>
                      <div className="flex gap-2">
                        {SIZES.map(size => (
                          <button
                            key={size}
                            onClick={() => setSelectedSize(size)}
                            className={`w-12 h-12 flex items-center justify-center text-[11px] font-bold border transition-all ${
                              selectedSize === size 
                              ? 'bg-black text-white border-black shadow-xl ring-4 ring-black/5' 
                              : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-300 font-mono">Quantity</p>
                      <div className="flex items-center border border-gray-100 h-12 w-fit bg-gray-50 shadow-sm">
                        <button 
                          onClick={() => setSelectedQuantity(q => Math.max(1, q - 1))}
                          className="w-12 h-full flex items-center justify-center hover:bg-gray-200 transition-colors border-r border-gray-100"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <div className="w-12 text-center text-[12px] font-bold font-mono">
                          {selectedQuantity}
                        </div>
                        <button 
                          onClick={() => setSelectedQuantity(q => q + 1)}
                          className="w-12 h-full flex items-center justify-center hover:bg-gray-200 transition-colors border-l border-gray-100"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Note removed */}
                </div>

                <div className="mt-auto p-12 bg-white border-t border-gray-50 flex flex-col gap-4">
                  <button 
                    onClick={(e) => {
                      addToCart(selectedCollection, e, selectedSize, selectedQuantity, selectedCollection.images[activeImageIndex]?.url);
                      setSelectedCollection(null);
                    }}
                    className="w-full bg-black text-white py-6 text-[12px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:translate-y-[-2px] active:translate-y-0 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.1)]"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Place Order
                  </button>
                  <p className="text-[9px] text-center text-gray-300 uppercase tracking-[0.2em]">
                    Instant archive identification provided after confirmation
                  </p>
                </div>
              </div>

              <input 
                type="file" 
                ref={collectionFileInputRef}
                onChange={(e) => handleAddToCollection(e, selectedCollection)}
                className="hidden" 
                multiple 
                accept="image/*"
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Header */}
      <header className="py-10 px-6 flex justify-between items-center max-w-6xl mx-auto shadow-sm sticky top-0 bg-white z-40">
        <button 
          onClick={() => setIsUploadModalOpen(true)}
          className="p-2 hover:bg-gray-50 rounded-full transition-colors flex items-center justify-center group"
          title="Add to collection"
        >
          <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>
        <h1 className="text-3xl font-extralight uppercase tracking-widest text-center flex-1">The Collection</h1>
        <button 
          ref={cartIconRef}
          onClick={() => setIsCartOpen(true)}
          className="relative p-2 hover:bg-gray-50 rounded-full transition-colors"
        >
          <ShoppingBag className="h-6 w-6" />
          {cartTotalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold">
              {cartTotalItems}
            </span>
          )}
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 pt-12">
        {/* Filter Navigation */}
        <nav className="flex justify-center gap-6 mb-10 overflow-x-auto pb-4 sticky top-[116px] bg-white/80 backdrop-blur-sm z-10">
          <button 
            onClick={() => setCurrentFilter('all')}
            className={`text-xs uppercase tracking-widest pb-1 border-b-2 transition-all ${currentFilter === 'all' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
          >
            All
          </button>
          <button 
            onClick={() => setCurrentFilter('untagged')}
            className={`text-xs uppercase tracking-widest pb-1 border-b-2 transition-all ${currentFilter === 'untagged' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
          >
            Untagged
          </button>
          {ALLOWED_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setCurrentFilter(tag)}
              className={`text-xs uppercase tracking-widest pb-1 border-b-2 transition-all ${currentFilter === tag ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
            >
              {tag}
            </button>
          ))}

          <div className="flex items-center ml-2 border-l border-gray-100 pl-4">
            <AnimatePresence>
              {isSearchOpen && (
                <motion.input
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 120, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  type="text"
                  placeholder="ID / TAG..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-[10px] uppercase tracking-[0.2em] outline-none bg-transparent py-1 border-b border-black/10 focus:border-black transition-colors"
                  autoFocus
                />
              )}
            </AnimatePresence>
            <button 
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setSearchTerm('');
              }}
              className={`p-1 transition-colors ${isSearchOpen ? 'text-black' : 'text-gray-300 hover:text-black'}`}
              title="Search collection"
            >
              {isSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
        </nav>

        {/* Gallery */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
             <Loader2 className="h-8 w-8 animate-spin mb-4" />
             <p className="text-sm font-light tracking-wide">Loading your collection...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 px-4">
            <p className="text-red-500 mb-4">{error}</p>
            <button 
              onClick={fetchItems}
              className="px-6 py-2 border border-black text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-all"
            >
              Try Again
            </button>
            <p className="mt-8 text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
              Ensure you have set the <strong>CLOUDINARY_URL</strong> in the <strong>Secrets</strong> panel (Settings &gt; Secrets). 
              If your images are not in the <code>clothing_gallery/</code> folder in Cloudinary, they may not appear.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
            <AnimatePresence mode='popLayout'>
              {filteredItems.map(item => (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group flex flex-col"
                >
                  <div className="relative aspect-[2/3] overflow-hidden bg-gray-50 mb-3 cursor-pointer" onClick={() => setSelectedCollection(item)}>
                    <img 
                      src={item.representativeImage} 
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 shadow-sm border border-black/5 flex items-center gap-1.5 translate-y-0 group-hover:-translate-y-1 transition-transform">
                      <div className="flex -space-x-1">
                        {[...Array(Math.min(3, item.images.length))].map((_, i) => (
                           <div key={i} className="w-1 h-1 bg-black rounded-full" />
                        ))}
                      </div>
                      <span className="text-[7px] font-bold uppercase tracking-widest text-black">
                        {item.images.length} ARCHIVES
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest truncate cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setSelectedCollection(item)}>
                      {item.title}
                    </h3>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest font-mono">
                      {item.tags.filter(t => ALLOWED_TAGS.includes(t)).join(' / ') || 'CLASSIFIED'}
                    </p>
                    
                    <div className="flex items-center gap-4 pt-2">
                      <button 
                        onClick={() => {
                          setEditingId(item.id);
                          setEditTags(new Set(item.tags.filter(t => ALLOWED_TAGS.includes(t))));
                        }}
                        className="text-[10px] uppercase underline tracking-widest text-[#4a90e2] hover:text-blue-700 transition-colors"
                      >
                        Edit Tags
                      </button>
                      
                      <button 
                        onClick={() => setDeletingId(item.id)}
                        className="text-[10px] uppercase underline tracking-widest text-[#ff4757] hover:text-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    </div>

                    <button 
                      onClick={(e) => addToCart(item, e, 'M')}
                      className="mt-3 w-full border border-black py-2 text-[10px] uppercase tracking-widest font-semibold hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="h-3 w-3" />
                      Add to cart
                    </button>

                    {/* Quick Edit Panel */}
                    <AnimatePresence>
                      {editingId === item.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-4 p-4 bg-gray-50 border border-gray-100 overflow-hidden"
                        >
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {ALLOWED_TAGS.map(tag => (
                              <button
                                key={tag}
                                onClick={() => toggleTag(tag, editTags, setEditTags)}
                                className={`px-2 py-0.5 text-[9px] uppercase border transition-colors ${
                                  editTags.has(tag) 
                                  ? 'bg-black text-white border-black' 
                                  : 'bg-white text-gray-400 border-gray-200'
                                }`}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                             <button 
                               onClick={() => handleUpdateTags(item)}
                               className="flex-1 py-2 bg-black text-white text-[10px] uppercase font-bold tracking-widest"
                             >
                               Update
                             </button>
                             <button 
                               onClick={() => setEditingId(null)}
                               className="px-4 py-2 border border-gray-300 text-[10px] uppercase tracking-widest"
                             >
                               <X className="h-3 w-3" />
                             </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="text-center py-20 text-gray-400 font-light tracking-widest text-sm">
            No items found in this category.
          </div>
        )}
      </main>


      {/* Flying Items Animation */}
      <AnimatePresence>
        {flyingItems.map(item => {
          const target = cartIconRef.current?.getBoundingClientRect();
          if (!target) return null;
          return (
            <motion.div
              key={item.id}
              initial={{ 
                position: 'fixed',
                top: item.startY,
                left: item.startX,
                width: 40,
                height: 60,
                opacity: 1,
                zIndex: 100,
                borderRadius: '4px',
                overflow: 'hidden'
              }}
              animate={{ 
                top: target.top + 20,
                left: target.left + 20,
                width: 10,
                height: 15,
                opacity: 0,
                scale: 0.5
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="pointer-events-none"
            >
              <img src={item.image} className="w-full h-full object-cover" />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="fixed inset-0 m-auto h-fit max-w-sm w-full bg-white z-[110] shadow-2xl p-8 rounded-lg text-center"
            >
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                  <Trash2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-light uppercase tracking-widest mb-2">Remove Collection?</h3>
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-8 leading-loose">
                  This action cannot be undone. All items in this collection will be permanently removed.
                </p>
                <div className="flex flex-col w-full gap-3">
                  <button
                    onClick={() => {
                      const collection = items.find(i => i.id === deletingId);
                      if (collection) handleDeleteCollection(collection);
                    }}
                    className="w-full bg-[#ff4757] text-white py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-red-600 transition-colors"
                  >
                    Yes, Remove Collection
                  </button>
                  <button
                    onClick={() => setDeletingId(null)}
                    className="w-full border border-gray-100 py-4 text-xs font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-black hover:border-black transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !uploading && setIsUploadModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-4"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="fixed inset-0 m-auto h-fit max-w-lg w-full bg-white z-[80] shadow-2xl p-8 rounded-lg overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-light uppercase tracking-widest text-gray-400">Add to Collection</h2>
                <button 
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={uploading}
                  className="hover:rotate-90 transition-transform p-2 disabled:opacity-20"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3 text-center">Collection Name</label>
                  <input 
                    type="text" 
                    placeholder="E.G. SUMMER DROP 24" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 py-4 px-6 text-center text-sm uppercase tracking-widest outline-none focus:border-black transition-colors"
                  />
                </div>

                <div 
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed py-12 px-6 text-center cursor-pointer transition-all rounded-sm group ${
                    selectedFiles.length > 0 ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-200'
                  } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <Upload className={`mx-auto h-10 w-10 mb-4 transition-colors ${selectedFiles.length > 0 ? 'text-black' : 'text-gray-200 group-hover:text-gray-400'}`} />
                  <p className="text-sm text-gray-500 font-light tracking-wide">
                    {selectedFiles.length > 0 ? `${selectedFiles.length} files selected` : "Drag and drop or click to upload"}
                  </p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} 
                    multiple 
                    hidden 
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3 text-center">Categorize Item</label>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {ALLOWED_TAGS.map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag, selectedTags, setSelectedTags)}
                        disabled={uploading}
                        className={`px-5 py-2 rounded-full text-[10px] uppercase tracking-wider transition-all border ${
                          selectedTags.has(tag) 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={async () => {
                      await handleFileUpload();
                      setIsUploadModalOpen(false);
                    }}
                    disabled={uploading || selectedFiles.length === 0}
                    className="w-full py-5 bg-black text-white font-bold uppercase tracking-[0.3em] text-xs disabled:bg-gray-100 disabled:text-gray-300 flex items-center justify-center gap-3 shadow-lg hover:bg-gray-900 transition-colors"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create Collection
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cart Sidebar */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-[60] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b flex justify-between items-center bg-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 border border-black">
                     <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em]">Archived Sets</h2>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-0.5">{cartTotalItems} Units currently selected</p>
                  </div>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="hover:rotate-90 transition-transform p-1 text-gray-300 hover:text-black">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 opacity-30">
                    <ShoppingBag className="h-12 w-12 stroke-[1px]" />
                    <p className="text-[10px] uppercase tracking-[0.3em]">No sets archived</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {cart.map((cartItem) => (
                      <div key={`${cartItem.item.id}-${cartItem.size}`} className="flex gap-4 group">
                        <div className="w-20 aspect-[2/3] bg-gray-100 overflow-hidden shadow-sm relative">
                          <img src={cartItem.imageUrl || cartItem.item.representativeImage} alt={cartItem.item.title} className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                          <div className="absolute top-1 right-1 bg-black/10 backdrop-blur-sm px-1 rounded text-[7px] uppercase tracking-tighter text-black/40">
                            SET
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="text-[10px] font-bold uppercase tracking-widest leading-tight">{cartItem.item.title} ({cartItem.size})</h4>
                              <button 
                                onClick={() => removeFromCart(cartItem.item.id, cartItem.size)}
                                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1 font-mono">
                              {cartItem.item.tags.filter(t => ALLOWED_TAGS.includes(t)).join(' / ') || 'CLASSIFIED'}
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center border border-gray-100">
                              <button 
                                onClick={() => updateQuantity(cartItem.item.id, cartItem.size, -1)}
                                className="p-1.5 hover:bg-gray-50 border-r border-gray-100 transition-colors"
                              >
                                <Minus className="h-2.5 w-2.5" />
                              </button>
                              <input 
                                type="number"
                                min="1"
                                value={cartItem.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  updateQuantity(cartItem.item.id, cartItem.size, isNaN(val) ? 1 : val, true);
                                }}
                                className="w-8 text-center text-[10px] font-mono font-bold bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button 
                                onClick={() => updateQuantity(cartItem.item.id, cartItem.size, 1)}
                                className="p-1.5 hover:bg-gray-50 border-l border-gray-100 transition-colors"
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </button>
                            </div>
                            <span className="text-[8px] font-mono text-gray-300">ID:{cartItem.item.id.substr(0,6).toUpperCase()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 ? (
                <div className="p-6 border-t space-y-4">
                  <button 
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsBillOpen(true);
                    }}
                    className="w-full bg-black text-white py-4 text-xs font-semibold uppercase tracking-widest hover:bg-gray-900 transition-colors"
                  >
                    Generate Bill
                  </button>
                  <p className="text-[10px] text-center text-gray-400 uppercase tracking-widest">
                    Ready to finalize your selection?
                  </p>
                </div>
              ) : (
                <div className="p-6 border-t">
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="w-full border border-black py-4 text-xs font-semibold uppercase tracking-widest hover:bg-black hover:text-white transition-all"
                  >
                    Start Shopping
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Bill Modal */}
      <AnimatePresence>
        {isBillOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBillOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120]"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="fixed inset-0 m-auto h-fit max-w-[340px] w-full z-[130] flex flex-col items-center p-4"
            >
              {/* Receipt Area */}
              <div className="w-full max-h-[70vh] overflow-y-auto bg-white shadow-2xl rounded-sm scrollbar-hide">
                <div 
                  ref={billRef}
                  className="w-full bg-white p-6 relative overflow-hidden receipt-paper"
                >
                  {/* Decorative dots/perforation style */}
                  <div className="absolute top-0 left-0 w-full h-1 flex justify-between px-2">
                    {[...Array(15)].map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-black/5 rounded-full -mt-0.5" />
                    ))}
                  </div>

                  <div className="text-center mb-6">
                    <div className="flex justify-center mb-3">
                       <span className="p-2 border border-black rounded-md">
                         <FileText className="h-5 w-5" />
                       </span>
                    </div>
                    <h2 className="text-lg font-bold uppercase tracking-[0.2em]">The Collection</h2>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-0.5">Selection Summary</p>
                    <p className="text-[8px] font-mono text-gray-300 mt-2 leading-none">
                      NO: {Math.random().toString(36).substr(2, 6).toUpperCase()} / {new Date().toLocaleDateString()}
                    </p>
                  </div>

                  <div className="space-y-4 mb-6">
                    {cart.map((item) => (
                      <div key={`${item.item.id}-${item.size}`} className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider">{item.item.title} ({item.size})</p>
                          <p className="text-[8px] text-gray-400 uppercase mt-0.5 truncate max-w-[150px]">
                            {item.item.tags.join(' / ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-mono">x{item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase tracking-widest text-gray-400">Total Items</span>
                      <span className="text-xs font-bold font-mono">{cartTotalItems}</span>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="inline-block px-3 py-0.5 border border-black mb-3">
                      <p className="text-[9px] uppercase font-bold tracking-[0.1em]">Validated</p>
                    </div>
                    <p className="text-[8px] uppercase tracking-widest text-gray-300 leading-relaxed max-w-[180px] mx-auto">
                      Archived version. Keep for your records.
                    </p>
                  </div>

                  {/* Bottom decorative dots */}
                  <div className="absolute bottom-0 left-0 w-full h-1 flex justify-between px-2">
                    {[...Array(15)].map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-black/5 rounded-full -mb-0.5" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons (outside capture area) */}
              <div className="flex gap-2 w-full mt-4">
                <button
                  onClick={downloadBill}
                  disabled={isDownloading}
                  className="flex-1 bg-black text-white py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-800 transition-all shadow-lg active:scale-95"
                >
                  {isDownloading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-3 w-3" />
                      Save Receipt
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsBillOpen(false)}
                  className="px-4 border border-white/20 text-white/50 hover:text-white transition-all uppercase text-[9px] tracking-widest"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
