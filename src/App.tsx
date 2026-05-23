import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, Search, Edit2, Trash2, Plus, Loader2, ShoppingBag, ShoppingCart, Minus, Trash, Download, FileText, ChevronLeft, ChevronRight, LogOut, Eye, Inbox, Menu, Tag, Users, Mail, Clock} from 'lucide-react';
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
  price?: number;
  uploadedAt?: string;
  uploadedBy?: string;
}

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
  const [cart, setCart] = useState<{ item: ClothingItem; quantity: number; size: Size; imageUrl?: string }[]>(() => {
    try { const s = localStorage.getItem('cart'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
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

  // New feature state
  const [billOrderNumber, setBillOrderNumber] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [filePreviewUrls, setFilePreviewUrls] = useState<string[]>([]);
  const [uploadPrice, setUploadPrice] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [modalTags, setModalTags] = useState<Set<string>>(new Set());
  const [modalPrice, setModalPrice] = useState('');
  const [modalSaved, setModalSaved] = useState(false);

  // Interested list state
  const [interestedItems, setInterestedItems] = useState<ClothingItem[]>([]);
  const [isInterestedOpen, setIsInterestedOpen] = useState(false);
  const [interestedLists, setInterestedLists] = useState<any[]>([]);
  const [isInterestedListsOpen, setIsInterestedListsOpen] = useState(false);
  const [sendingInterested, setSendingInterested] = useState(false);
  const [interestedSent, setInterestedSent] = useState(false);
  const [myInterestedLists, setMyInterestedLists] = useState<any[]>([]);
  const [interestedTab, setInterestedTab] = useState<'current' | 'sent'>('current');
  const [myCartOrders, setMyCartOrders] = useState<any[]>([]);
  const [cartTab, setCartTab] = useState<'cart' | 'orders'>('cart');
  const [sendingOrder, setSendingOrder] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [shoperTab, setShoperTab] = useState<'interested' | 'orders'>('interested');
  const [megaInboxTab, setMegaInboxTab] = useState<'open' | 'history'>('open');
  const [megaOrdersTab, setMegaOrdersTab] = useState<'open' | 'history'>('open');
  const [cartOrders, setCartOrders] = useState<any[]>([]);

  // Tags state (dynamic from DB)
  const [allowedTags, setAllowedTags] = useState<string[]>(['Shirt', 'Pants', 'Skirt', 'Top', 'Dress', 'Bodysuit', 'Jacket']);

  // Admin panel state
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<'users' | 'tags' | 'orders'>('users');
  const [adminOrdersTab, setAdminOrdersTab] = useState<'interested' | 'cart' | 'history'>('interested');
  const [adminUsers, setAdminUsers] = useState<{ id: number; username: string; permissions: string[]; groups: string[]; locked?: number }[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [editingUser, setEditingUser] = useState<{ id: number; username: string; password: string; permissions: string[]; groups: string[] } | null>(null);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', permissions: [] as string[], groups: [] as string[] });
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [usersGroupsSubTab, setUsersGroupsSubTab] = useState<'groups' | 'users'>('groups');
  const [addingToGroup, setAddingToGroup] = useState<{ group: string; userId: string } | null>(null);

  // Auth state
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string; permissions: string[]; groups: string[] } | null>(null);
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

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
    const token = localStorage.getItem('auth_token');
    if (!token) { setIsInitializingAuth(false); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user) { setCurrentUser(user); }
        else { localStorage.removeItem('auth_token'); setAuthToken(null); }
      })
      .finally(() => setIsInitializingAuth(false));
  }, []);

  useEffect(() => {
    fetch('/api/tags').then(r => r.ok ? r.json() : null).then(tags => { if (tags) setAllowedTags(tags); });
  }, []);

  useEffect(() => {
    if (currentUser?.permissions.includes('view_interested_lists')) fetchShoperInboxData();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) fetchItems();
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!currentUser) return;
    const TIMEOUT = 30 * 60 * 1000;
    const updateActivity = () => localStorage.setItem('last_activity', Date.now().toString());
    const checkInactivity = () => {
      const last = Number(localStorage.getItem('last_activity') || Date.now());
      if (Date.now() - last > TIMEOUT) handleLogout();
    };
    updateActivity();
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, updateActivity));
    const interval = setInterval(checkInactivity, 60 * 1000);
    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [currentUser]);

  useEffect(() => {
    if (isBillOpen) setBillOrderNumber(Math.random().toString(36).substring(2, 8).toUpperCase());
  }, [isBillOpen]);

  useEffect(() => {
    if (isInterestedOpen && hasPermission('send_interested')) fetchMyInterestedLists();
  }, [isInterestedOpen]);

  useEffect(() => {
    if (isCartOpen && hasPermission('view_cart') && currentUser) fetchMyCartOrders();
  }, [isCartOpen]);

  const hasPermission = (p: string) => currentUser?.permissions.includes(p) ?? false;

  const authFetch = (url: string, options: RequestInit = {}) =>
    fetch(url, {
      ...options,
      headers: { ...(options.headers as Record<string, string> || {}), ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }
    });

  const handleLogin = async () => {
    if (!loginUsername || !loginPassword) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || 'Login failed'); return; }
      localStorage.setItem('auth_token', data.token);
      setAuthToken(data.token);
      setCurrentUser(data.user);
    } catch {
      setLoginError('Connection error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setAuthToken(null);
    setCurrentUser(null);
    setItems([]);
  };

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

  const handleFilesChange = (files: File[]) => {
    setSelectedFiles(files);
    filePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setFilePreviewUrls(files.map(f => URL.createObjectURL(f)));
  };

  const handleSetPrice = async (collectionId: string, price: string) => {
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) return;
    await authFetch('/api/set-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId, price: p }),
    });
  };

  const handleUpdateTitle = async (item: ClothingItem) => {
    const trimmed = editTitleValue.trim();
    if (!trimmed || trimmed === item.title) { setEditingTitleId(null); return; }
    try {
      const res = await authFetch('/api/update-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId: item.id, title: trimmed }),
      });
      if (res.ok) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, title: trimmed } : i));
        if (selectedCollection?.id === item.id) setSelectedCollection(prev => prev ? { ...prev, title: trimmed } : null);
      }
    } catch (e) { console.error(e); }
    finally { setEditingTitleId(null); }
  };

  const handleSaveModalChanges = async () => {
    if (!selectedCollection) return;
    const currentTags = selectedCollection.tags.filter(t => allowedTags.includes(t));
    const tagsChanged = JSON.stringify([...modalTags].sort()) !== JSON.stringify([...currentTags].sort());
    const newPrice = parseFloat(modalPrice);
    const priceChanged = (isNaN(newPrice) ? 0 : newPrice) !== (selectedCollection.price || 0);
    if (!tagsChanged && !priceChanged) return;

    if (tagsChanged && hasPermission('edit_tags')) {
      const publicIds = selectedCollection.images.map(img => img.id);
      const res = await authFetch('/api/update-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicIds, tags: Array.from(modalTags) }),
      });
      if (res.ok) {
        const newTags = Array.from(modalTags);
        setItems(prev => prev.map(i => i.id === selectedCollection.id ? { ...i, tags: newTags } : i));
        setSelectedCollection({ ...selectedCollection, tags: newTags });
      }
    }

    if (priceChanged && hasPermission('upload_collection')) {
      const price = isNaN(newPrice) ? 0 : newPrice;
      await handleSetPrice(selectedCollection.id, String(price));
      setItems(prev => prev.map(i => i.id === selectedCollection.id ? { ...i, price } : i));
      setSelectedCollection({ ...selectedCollection, price });
    }

    setModalSaved(true);
    setTimeout(() => setModalSaved(false), 3000);
  };

  const toggleInterested = (item: ClothingItem) => {
    setInterestedItems(prev =>
      prev.find(i => i.id === item.id) ? prev.filter(i => i.id !== item.id) : [...prev, item]
    );
  };

  const sendInterestedList = async () => {
    if (interestedItems.length === 0) return;
    setSendingInterested(true);
    try {
      const res = await authFetch('/api/interested-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: interestedItems }),
      });
      if (res.ok) {
        setInterestedItems([]);
        setInterestedSent(true);
        setTimeout(() => setInterestedSent(false), 3000);
        await fetchMyInterestedLists();
        setInterestedTab('sent');
      }
    } catch (e) { console.error(e); }
    finally { setSendingInterested(false); }
  };

  const fetchMyInterestedLists = async () => {
    const res = await authFetch('/api/my-interested-lists');
    if (res.ok) setMyInterestedLists(await res.json());
  };

  const fetchMyCartOrders = async () => {
    const res = await authFetch('/api/my-cart-orders');
    if (res.ok) setMyCartOrders(await res.json());
  };

  const sendCartOrder = async () => {
    if (cart.length === 0) return;
    setSendingOrder(true);
    try {
      const items = cart.map(c => ({
        id: c.item.id,
        title: c.item.title,
        imageUrl: c.imageUrl || c.item.representativeImage,
        price: c.item.price,
        quantity: c.quantity,
        size: c.size,
      }));
      const res = await authFetch('/api/cart-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (res.ok) {
        setOrderSent(true);
        setTimeout(() => setOrderSent(false), 3000);
        await fetchMyCartOrders();
        setCartTab('orders');
      }
    } catch (e) { console.error(e); }
    finally { setSendingOrder(false); }
  };

  const fetchShoperInboxData = async () => {
    const [intRes, ordRes] = await Promise.all([
      authFetch('/api/interested-lists'),
      authFetch('/api/cart-orders'),
    ]);
    if (intRes.ok) setInterestedLists(await intRes.json());
    if (ordRes.ok) setCartOrders(await ordRes.json());
  };

  const fetchShoperData = async () => {
    await fetchShoperInboxData();
    setIsInterestedListsOpen(true);
  };

  const handleInterestedList = async (id: number) => {
    await authFetch(`/api/interested-lists/${id}/handle`, { method: 'PATCH' });
    setInterestedLists(prev => prev.map((l: any) => l.id === id ? { ...l, handled_at: new Date().toISOString() } : l));
    setMyInterestedLists(prev => prev.map((l: any) => l.id === id ? { ...l, handled_at: new Date().toISOString() } : l));
  };

  const markShoperHandled = async (id: number) => {
    await authFetch(`/api/interested-lists/${id}/shoper-handle`, { method: 'PATCH' });
    const now = new Date().toISOString();
    setInterestedLists(prev => prev.map((l: any) => l.id === id ? { ...l, my_handled_at: now } : l));
  };

  const handleCartOrder = async (id: number) => {
    await authFetch(`/api/cart-orders/${id}/handle`, { method: 'PATCH' });
    setCartOrders(prev => prev.map((o: any) => o.id === id ? { ...o, handled_at: new Date().toISOString() } : o));
    setMyCartOrders(prev => prev.map((o: any) => o.id === id ? { ...o, handled_at: new Date().toISOString() } : o));
  };

  const ALL_PERMISSIONS = ['upload_collection', 'remove_collection', 'edit_tags', 'view_cart', 'send_interested', 'view_interested_lists', 'admin'];

  const GROUPS = [
    { value: 'administrators', label: 'Administrator', permissions: ['upload_collection', 'remove_collection', 'edit_tags', 'view_cart', 'send_interested', 'view_interested_lists', 'admin'] },
    { value: 'super_viewers', label: 'Super Viewer', permissions: ['upload_collection', 'edit_tags', 'view_interested_lists'] },
    { value: 'shopers', label: 'Shoper', permissions: ['upload_collection', 'edit_tags', 'view_interested_lists'] },
    { value: 'buyers', label: 'Buyer', permissions: ['view_cart', 'remove_collection', 'send_interested'] },
  ];

  const isSuperViewer = () => currentUser?.groups?.some(g => g === 'super_viewers' || g === 'administrators') ?? false;

  const fetchAdminOrders = async () => {
    const [intRes, ordRes] = await Promise.all([
      authFetch('/api/interested-lists'),
      authFetch('/api/cart-orders'),
    ]);
    if (intRes.ok) setInterestedLists(await intRes.json());
    if (ordRes.ok) setCartOrders(await ordRes.json());
  };

  const fetchAdminUsers = async () => {
    const res = await authFetch('/api/admin/users');
    if (res.ok) setAdminUsers(await res.json());
  };

  const createAdminUser = async () => {
    if (!newUserForm.username || !newUserForm.password) return;
    const res = await authFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newUserForm, groups: newUserForm.groups }),
    });
    if (res.ok) {
      await fetchAdminUsers();
      setNewUserForm({ username: '', password: '', permissions: [], groups: [] });
      setShowNewUserForm(false);
    }
  };

  const updateAdminUser = async () => {
    if (!editingUser) return;
    const res = await authFetch(`/api/admin/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: editingUser.username, password: editingUser.password || undefined, permissions: editingUser.permissions, groups: editingUser.groups }),
    });
    if (res.ok) {
      await fetchAdminUsers();
      setEditingUser(null);
    }
  };

  const deleteAdminUser = async (id: number) => {
    const res = await authFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchAdminUsers();
  };

  const toggleUserLock = async (id: number) => {
    const res = await authFetch(`/api/admin/users/${id}/lock`, { method: 'PATCH' });
    if (res.ok) await fetchAdminUsers();
  };

  const addUserToGroup = async (userId: number, group: string) => {
    const user = adminUsers.find((u: typeof adminUsers[0]) => u.id === userId);
    if (!user) return;
    const newGroups = [...new Set([...(user.groups || []), group])];
    const res = await authFetch(`/api/admin/users/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groups: newGroups }) });
    if (res.ok) await fetchAdminUsers();
  };

  const removeUserFromGroup = async (userId: number, group: string) => {
    const user = adminUsers.find((u: typeof adminUsers[0]) => u.id === userId);
    if (!user) return;
    const newGroups = (user.groups || []).filter((g: string) => g !== group);
    const res = await authFetch(`/api/admin/users/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groups: newGroups }) });
    if (res.ok) await fetchAdminUsers();
  };

  const addAdminTag = async () => {
    const name = newTagInput.trim();
    if (!name) return;
    const res = await authFetch('/api/admin/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data = await res.json();
      setAllowedTags(prev => [...prev, data.name].sort());
      setNewTagInput('');
    }
  };

  const removeAdminTag = async (name: string) => {
    const res = await authFetch(`/api/admin/tags/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (res.ok) setAllowedTags(prev => prev.filter(t => t !== name));
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) return alert("Please select images!");

    setUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      const newImages: ServerImage[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        setUploadProgress({ current: i + 1, total: selectedFiles.length });
        const formData = new FormData();
        formData.append('title', title || "Unnamed");
        formData.append('batchId', batchId);
        formData.append('tags', Array.from(selectedTags).join(','));
        formData.append('image', selectedFiles[i]);

        const res = await authFetch('/api/upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `Upload failed with status ${res.status}`);
        }
        const data = await res.json();
        if (data.success && data.file) newImages.push(data.file);
      }

      const price = parseFloat(uploadPrice);
      if (!isNaN(price) && price > 0) await handleSetPrice(batchId, uploadPrice);

      if (newImages.length > 0) {
        const tempCollection: ClothingItem = {
          id: batchId,
          title: title || "Unnamed",
          representativeImage: newImages[0].filename,
          images: newImages.map(item => ({ id: item.id, url: item.filename })),
          tags: Array.from(selectedTags),
          price: !isNaN(price) ? price : 0,
        };
        setItems(prev => [tempCollection, ...prev]);
      }

      setTitle('');
      setSelectedTags(new Set());
      setSelectedFiles([]);
      setUploadPrice('');
      filePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      setFilePreviewUrls([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsUploadModalOpen(false);
      setTimeout(fetchItems, 3000);
    } catch (err: any) {
      console.error("Upload error:", err);
      alert(`Upload failed: ${err.message || "An unknown error occurred"}`);
    } finally {
      setUploading(false);
      setUploadProgress(null);
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

        const res = await authFetch('/api/upload', {
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
    setUploading(true);
    try {
      // Use for...of to allow better error handling or sequencing if needed
      // Though Promise.all is fine if we don't mind parallel fails
      const results = await Promise.all(
        collection.images.map(img => 
          authFetch(`/api/delete-image?id=${encodeURIComponent(img.id)}&batchId=${encodeURIComponent(collection.id)}`, { method: 'DELETE' })
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
      const res = await authFetch('/api/update-tags', {
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
    if (selectedCollection) {
      setModalTags(new Set(selectedCollection.tags.filter(t => allowedTags.includes(t))));
      setModalPrice(selectedCollection.price ? String(selectedCollection.price) : '');
    } else {
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
    const itemTags = item.tags.filter(t => allowedTags.includes(t));
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

  if (isInitializingAuth) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-10">
          <div className="text-center">
            <h1 className="text-3xl font-extralight uppercase tracking-widest">The Collection</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mt-3">Staff Access</p>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={loginUsername}
              onChange={e => setLoginUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full bg-gray-50 border border-gray-100 py-4 px-6 text-sm outline-none focus:border-black transition-colors text-center"
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full bg-gray-50 border border-gray-100 py-4 px-6 text-sm outline-none focus:border-black transition-colors text-center"
            />
            {loginError && (
              <p className="text-center text-[10px] text-red-500 uppercase tracking-widest">{loginError}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full py-5 bg-black text-white font-bold uppercase tracking-[0.3em] text-xs disabled:bg-gray-100 disabled:text-gray-300 flex items-center justify-center gap-3 hover:bg-gray-900 transition-colors"
            >
              {loginLoading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Enter'}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                className="absolute top-6 right-6 z-30 p-2 bg-white/50 backdrop-blur-md rounded-full hover:bg-white hover:rotate-90 transition-all shadow-sm"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Left: Interactive Image Gallery */}
              <div className="flex-[1.5] bg-[#f9f9f9] flex flex-col relative overflow-hidden group/gallery border-r border-gray-50">
                <div className="flex-1 flex items-center justify-center p-8 md:p-12 relative overflow-hidden">
                  <AnimatePresence mode='wait'>
                    <motion.div
                      key={selectedCollection.images[activeImageIndex]?.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      <img 
                        src={selectedCollection.images[activeImageIndex]?.url} 
                        alt={selectedCollection.title}
                        className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-2xl"
                      />
                    </motion.div>
                  </AnimatePresence>

                  {/* Nav Arrows */}
                  {selectedCollection.images.length > 1 && (
                    <>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImageIndex(i => (i - 1 + selectedCollection.images.length) % selectedCollection.images.length);
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 backdrop-blur-md rounded-full shadow-xl opacity-0 group-hover/gallery:opacity-100 transition-all hover:bg-black hover:text-white"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImageIndex(i => (i + 1) % selectedCollection.images.length);
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 backdrop-blur-md rounded-full shadow-xl opacity-0 group-hover/gallery:opacity-100 transition-all hover:bg-black hover:text-white"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnails Section - Improved visibility */}
                <div className="px-6 py-4 bg-white border-t border-gray-100">
                  <div className="flex gap-3 overflow-x-auto pb-1 px-1 scrollbar-hide">
                    {selectedCollection.images.map((img, idx) => (
                      <div key={img.id} className="relative shrink-0">
                        <button 
                          onClick={() => setActiveImageIndex(idx)}
                          className={`w-16 h-20 bg-gray-50 rounded-sm overflow-hidden border-2 transition-all duration-300 ${
                            activeImageIndex === idx ? 'border-black scale-105 shadow-md' : 'border-transparent opacity-50 hover:opacity-100'
                          }`}
                        >
                          <img src={img.url} className="w-full h-full object-cover" alt={`thumb-${idx}`} />
                        </button>
                      </div>
                    ))}
                    
                    {hasPermission('upload_collection') && (
                      <button
                        onClick={() => collectionFileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-16 h-20 border-2 border-dashed border-gray-200 rounded-sm flex flex-col items-center justify-center gap-1 hover:border-black/30 hover:bg-gray-50 transition-all shrink-0 grayscale hover:grayscale-0"
                      >
                        <Plus className="h-4 w-4 text-gray-400" />
                        <span className="text-[9px] font-bold uppercase tracking-tighter text-gray-400">Add</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Details & Operations */}
              <div className="flex-1 flex flex-col bg-white overflow-y-auto">
                <div className="p-8 md:p-12 space-y-10">
                  <div>
                    <div className="inline-block px-2 py-0.5 border border-black mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest leading-none">Studio Archive</p>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold uppercase tracking-tighter leading-tight break-all">
                      {selectedCollection.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-4">
                      <div className="h-px flex-1 bg-gray-100" />
                      <p className="text-[10px] text-gray-300 font-mono tracking-widest uppercase">ID: {selectedCollection.id.substr(0, 16)}</p>
                      {selectedCollection.uploadedAt && (
                        <>
                          <div className="h-3 w-px bg-gray-200" />
                          <p className="text-[10px] text-gray-300 font-mono tracking-widest uppercase">
                            {new Date(selectedCollection.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">Classification</p>
                      {hasPermission('edit_tags') && (
                        <p className="text-[9px] text-gray-300 uppercase tracking-widest">Tap to toggle</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allowedTags.map(tag => {
                        const active = modalTags.has(tag);
                        return hasPermission('edit_tags') ? (
                          <button
                            key={tag}
                            onClick={() => {
                              const next = new Set(modalTags);
                              next.has(tag) ? next.delete(tag) : next.add(tag);
                              setModalTags(next);
                            }}
                            className={`px-4 py-2 border text-[11px] uppercase font-bold tracking-widest transition-all ${
                              active ? 'bg-black text-white border-black' : 'bg-white text-gray-300 border-gray-200 hover:border-gray-400'
                            }`}
                          >{tag}</button>
                        ) : active ? (
                          <span key={tag} className="px-4 py-2 border border-black text-[11px] uppercase font-bold tracking-widest text-white bg-black">{tag}</span>
                        ) : null;
                      })}
                      {!hasPermission('edit_tags') && modalTags.size === 0 && (
                        <span className="text-gray-300 uppercase text-[10px] tracking-widest italic">No classification provided</span>
                      )}
                    </div>
                  </div>

                  {(hasPermission('upload_collection') || (selectedCollection.price ?? 0) > 0) && (
                    <div className="space-y-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">Price</p>
                      {hasPermission('upload_collection') ? (
                        <div className="flex items-center gap-2 border-b border-gray-200 w-fit pb-1 focus-within:border-black transition-colors">
                          <span className="text-lg font-mono text-gray-400">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={modalPrice}
                            onChange={e => setModalPrice(e.target.value)}
                            placeholder="0"
                            className="w-24 text-lg font-mono font-bold outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      ) : (
                        <p className="text-lg font-mono font-bold">${selectedCollection.price}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">Select Size</p>
                        <p className="text-[10px] text-gray-300 underline uppercase tracking-widest cursor-pointer hover:text-black transition-colors" onClick={() => setIsSizeGuideOpen(true)}>Size Guide</p>
                      </div>
                      <div className="flex gap-2">
                        {SIZES.map(size => (
                          <button
                            key={size}
                            onClick={() => setSelectedSize(size)}
                            className={`w-14 h-14 flex items-center justify-center text-[12px] font-bold border transition-all ${
                              selectedSize === size 
                              ? 'bg-black text-white border-black shadow-lg translate-y-[-2px]' 
                              : 'bg-white text-gray-400 border-gray-100 hover:border-gray-500'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">Quantity</p>
                      <div className="flex items-center border border-black h-14 w-36 bg-white overflow-hidden">
                        <button 
                          onClick={() => setSelectedQuantity(q => Math.max(1, q - 1))}
                          className="flex-1 h-full flex items-center justify-center hover:bg-gray-50 transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <div className="w-12 text-center text-[14px] font-bold font-mono">
                          {selectedQuantity}
                        </div>
                        <button 
                          onClick={() => setSelectedQuantity(q => q + 1)}
                          className="flex-1 h-full flex items-center justify-center hover:bg-gray-50 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto p-8 md:p-12 bg-gray-50 border-t border-gray-100 flex flex-col gap-6">
                  {(hasPermission('edit_tags') || hasPermission('upload_collection')) && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleSaveModalChanges}
                        className="w-full bg-white text-black py-4 text-[11px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 border-2 border-black hover:bg-black hover:text-white transition-all"
                      >
                        Save Changes
                      </button>
                      {modalSaved && (
                        <p className="text-center text-[10px] uppercase tracking-[0.2em] font-bold text-green-600">
                          ✓ Changes saved successfully
                        </p>
                      )}
                    </div>
                  )}
                  {(!currentUser || (hasPermission('view_cart') && !hasPermission('admin'))) && (
                    <button
                      onClick={(e: React.MouseEvent) => {
                        addToCart(selectedCollection, e, selectedSize, selectedQuantity, selectedCollection.images[activeImageIndex]?.url);
                        setSelectedCollection(null);
                      }}
                      className="w-full bg-black text-white py-6 text-[13px] font-bold uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all shadow-xl group"
                    >
                      <ShoppingBag className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      Place Order
                    </button>
                  )}
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
        <div className="flex items-center gap-1">
          {hasPermission('admin') && (
            <button
              onClick={() => { setIsAdminOpen(true); fetchAdminUsers(); fetchAdminOrders(); }}
              className="p-2 hover:bg-gray-50 rounded-full transition-colors"
              title="Admin Panel"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          {hasPermission('upload_collection') && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="p-2 hover:bg-gray-50 rounded-full transition-colors flex items-center justify-center group"
              title="Add to collection"
            >
              <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          )}
          <button
            onClick={handleLogout}
            title={`Logout (${currentUser.username})`}
            className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-300 hover:text-black"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        <h1 className="text-3xl font-extralight uppercase tracking-widest text-center flex-1">The Collection</h1>
        <div className="flex items-center gap-1">
          {hasPermission('send_interested') && !hasPermission('admin') && (
            <button
              onClick={() => setIsInterestedOpen(true)}
              className="relative p-2 hover:bg-gray-50 rounded-full transition-colors"
              title="My Interested List"
            >
              <Eye className="h-6 w-6" />
              {interestedItems.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold">
                  {interestedItems.length}
                </span>
              )}
            </button>
          )}
          {hasPermission('view_interested_lists') && !hasPermission('admin') && (
            <button
              onClick={fetchShoperData}
              className="relative p-2 hover:bg-gray-50 rounded-full transition-colors"
              title="Received Lists & Orders"
            >
              <Mail className="h-6 w-6" />
              {(() => { const openI = interestedLists.filter((l: any) => !l.handled_at && (isSuperViewer() || !l.my_handled_at)).length; const openO = cartOrders.filter((o: any) => !o.handled_at).length; return (openI + openO) > 0 && (
                <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold">
                  {openI + openO}
                </span>); })()}
            </button>
          )}
          {(!currentUser || (hasPermission('view_cart') && !hasPermission('admin'))) && (
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
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 pt-12">
        {/* Filter Navigation */}
        <nav className="flex justify-center gap-6 mb-10 overflow-x-auto pb-4 sticky top-[116px] bg-white/80 backdrop-blur-sm z-10">
          <button
            onClick={() => setCurrentFilter('all')}
            className={`text-xs uppercase tracking-widest pb-1 border-b-2 transition-all ${currentFilter === 'all' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
          >
            All ({items.length})
          </button>
          {allowedTags.map(tag => {
            const count = items.filter(i => i.tags.some((t: string) => t.toLowerCase() === tag.toLowerCase())).length;
            return (
              <button
                key={tag}
                onClick={() => setCurrentFilter(tag)}
                className={`text-xs uppercase tracking-widest pb-1 border-b-2 transition-all ${currentFilter === tag ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
              >
                {tag} ({count})
              </button>
            );
          })}
          {(() => { const n = items.filter(i => i.tags.filter((t: string) => allowedTags.includes(t)).length === 0).length; return n > 0 ? (
          <button
            onClick={() => setCurrentFilter('untagged')}
            className={`text-xs uppercase tracking-widest pb-1 border-b-2 transition-all ${currentFilter === 'untagged' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
          >
            Untagged ({n})
          </button>
          ) : null; })()}

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
                    <div className="flex items-center gap-1 group/title">
                      {editingTitleId === item.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            autoFocus
                            type="text"
                            value={editTitleValue}
                            onChange={e => setEditTitleValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleUpdateTitle(item); if (e.key === 'Escape') setEditingTitleId(null); }}
                            className="flex-1 text-[13px] font-bold uppercase tracking-widest border-b border-black outline-none bg-transparent"
                          />
                          <button onClick={() => handleUpdateTitle(item)} className="text-[10px] font-bold text-black">✓</button>
                          <button onClick={() => setEditingTitleId(null)} className="text-[10px] text-gray-400">✗</button>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-[14px] font-bold uppercase tracking-widest truncate cursor-pointer hover:opacity-70 transition-opacity flex-1" onClick={() => setSelectedCollection(item)}>
                            {item.title}
                          </h3>
                          {(item.price ?? 0) > 0 && (
                            <span className="text-[16px] font-bold font-mono text-black ml-auto shrink-0">${item.price}</span>
                          )}
                          {hasPermission('edit_tags') && (
                            <button
                              onClick={() => { setEditingTitleId(item.id); setEditTitleValue(item.title); }}
                              className="opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5"
                            >
                              <Edit2 className="h-3 w-3 text-gray-300 hover:text-black" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest font-mono">
                      {item.tags.filter((t: string) => allowedTags.includes(t)).join(' / ') || 'CLASSIFIED'}
                    </p>
                    {hasPermission('admin') && item.uploadedBy && (
                      <p className="text-[9px] text-gray-400 tracking-widest font-mono">by {item.uploadedBy}</p>
                    )}
                    
                    <div className="flex items-center gap-4 pt-2">
                      {hasPermission('remove_collection') && (
                        <button
                          onClick={() => setDeletingId(item.id)}
                          className="text-[10px] uppercase underline tracking-widest text-[#ff4757] hover:text-red-700 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {hasPermission('send_interested') && !hasPermission('admin') && (
                      <button
                        onClick={() => toggleInterested(item)}
                        className={`mt-3 w-full border py-2 text-[10px] uppercase tracking-widest font-semibold transition-all flex items-center justify-center gap-2 ${
                          interestedItems.find((i: ClothingItem) => i.id === item.id)
                            ? 'bg-black text-white border-black'
                            : 'border-black hover:bg-black hover:text-white'
                        }`}
                      >
                        <Eye className="h-3 w-3" />
                        {interestedItems.find((i: ClothingItem) => i.id === item.id) ? 'Interested' : 'Interested?'}
                      </button>
                    )}
                    {(!currentUser || (hasPermission('view_cart') && !hasPermission('admin'))) && (
                      <button
                        onClick={() => setSelectedCollection(item)}
                        className="mt-3 w-full border border-black py-2 text-[10px] uppercase tracking-widest font-semibold hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        Add to cart
                      </button>
                    )}

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
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e: React.DragEvent<HTMLDivElement>) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (uploading) return;
                    const files = Array.from(e.dataTransfer.files) as File[];
                    const images = files.filter(f => f.type.startsWith('image/'));
                    if (images.length > 0) handleFilesChange(images);
                  }}
                  className={`border-2 border-dashed py-10 px-6 text-center cursor-pointer transition-all rounded-sm group ${
                    isDragOver ? 'border-black bg-gray-50 scale-[1.01]' : selectedFiles.length > 0 ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-200'
                  } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <Upload className={`mx-auto h-10 w-10 mb-4 transition-colors ${selectedFiles.length > 0 || isDragOver ? 'text-black' : 'text-gray-200 group-hover:text-gray-400'}`} />
                  <p className="text-sm text-gray-500 font-light tracking-wide">
                    {isDragOver ? 'Drop images here' : selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected` : 'Drag and drop or click to upload'}
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFilesChange(Array.from(e.target.files || []))}
                    multiple
                    hidden
                    accept="image/*"
                  />
                </div>

                {filePreviewUrls.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {filePreviewUrls.map((url, i) => (
                      <div key={i} className="w-14 h-18 rounded-sm overflow-hidden bg-gray-50 border border-gray-100" style={{ height: '4.5rem' }}>
                        <img src={url} className="w-full h-full object-cover" alt={`preview-${i}`} />
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3 text-center">Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={uploadPrice}
                    onChange={(e) => setUploadPrice(e.target.value)}
                    disabled={uploading}
                    className="w-full bg-gray-50 border border-gray-100 py-3 px-6 text-center text-sm tracking-widest outline-none focus:border-black transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                {uploadProgress && (
                  <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest">
                    Uploading {uploadProgress.current} / {uploadProgress.total}...
                  </p>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3 text-center">Categorize Item</label>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {allowedTags.map(tag => (
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
              <div className="p-6 border-b flex justify-between items-center bg-white">
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

              {currentUser && (
                <div className="flex border-b shrink-0">
                  <button onClick={() => setCartTab('cart')} className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-colors ${cartTab === 'cart' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                    Cart {cart.length > 0 && `(${cart.length})`}
                  </button>
                  <button onClick={() => setCartTab('orders')} className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-colors ${cartTab === 'orders' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                    My Orders {myCartOrders.length > 0 && `(${myCartOrders.length})`}
                  </button>
                </div>
              )}

              {cartTab === 'orders' ? (
                <div className="flex-1 overflow-y-auto">
                  {myCartOrders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3 p-8">
                      <ShoppingBag className="h-10 w-10 stroke-[1px]" />
                      <p className="text-[10px] uppercase tracking-widest">No orders sent yet</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-5">
                      {myCartOrders.map((order: any, orderIdx: number) => (
                        <div key={order.id} className="border border-gray-100 rounded-sm overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-widest">Order #{myCartOrders.length - orderIdx}</p>
                            <div className="text-right">
                              {order.handled_at ? (
                                <p className="text-[9px] font-bold text-green-600 uppercase tracking-wider">✓ Handled</p>
                              ) : (
                                <p className="text-[9px] text-gray-400 font-mono">{new Date(order.sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                              )}
                            </div>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {order.items.map((item: any) => (
                              <div key={item.id} className="flex items-center gap-3 px-4 py-2">
                                <span className="text-[9px] font-mono text-gray-300 w-4 shrink-0">{item.position}.</span>
                                {item.representative_image && <div className="w-9 h-11 bg-gray-50 shrink-0 overflow-hidden"><img src={item.representative_image} alt={item.collection_title} className="w-full h-full object-cover" /></div>}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-widest truncate">{item.collection_title}</p>
                                  <p className="text-[9px] text-gray-400 font-mono">{item.size} × {item.quantity}</p>
                                </div>
                                {item.price && <p className="text-[10px] font-mono font-bold shrink-0">${(item.price * item.quantity).toFixed(0)}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
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
                              {cartItem.item.tags.filter(t => allowedTags.includes(t)).join(' / ') || 'CLASSIFIED'}
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
              )}

              {cartTab === 'cart' && (cart.length > 0 ? (
                <div className="p-6 border-t space-y-3 shrink-0">
                  {(() => {
                    const total = cart.reduce((acc, c) => acc + (c.item.price || 0) * c.quantity, 0);
                    return total > 0 ? (
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <span className="text-[10px] uppercase tracking-widest text-gray-400">Total</span>
                        <span className="text-sm font-bold font-mono">${total.toFixed(0)}</span>
                      </div>
                    ) : null;
                  })()}
                  {orderSent && <p className="text-center text-[10px] uppercase tracking-[0.2em] font-bold text-green-600">✓ Order sent to shoper</p>}
                  {currentUser && (
                    <button
                      onClick={sendCartOrder}
                      disabled={sendingOrder}
                      className="w-full bg-black text-white py-3 text-xs font-semibold uppercase tracking-widest hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {sendingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                      Send Order
                    </button>
                  )}
                  <button
                    onClick={() => { setIsCartOpen(false); setIsBillOpen(true); }}
                    className="w-full border border-black py-3 text-xs font-semibold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                  >
                    Generate Bill
                  </button>
                </div>
              ) : (
                <div className="p-6 border-t shrink-0">
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="w-full border border-black py-4 text-xs font-semibold uppercase tracking-widest hover:bg-black hover:text-white transition-all"
                  >
                    Start Shopping
                  </button>
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Interested Sidebar (buyer) */}
      <AnimatePresence>
        {isInterestedOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-[200]" onClick={() => setIsInterestedOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-[210] flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <h2 className="text-[11px] font-bold uppercase tracking-widest">Interested</h2>
                </div>
                <button onClick={() => setIsInterestedOpen(false)} className="hover:rotate-90 transition-transform p-1 text-gray-300 hover:text-black">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b">
                <button
                  onClick={() => setInterestedTab('current')}
                  className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-colors ${interestedTab === 'current' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}
                >
                  Current {interestedItems.length > 0 && `(${interestedItems.length})`}
                </button>
                <button
                  onClick={() => setInterestedTab('sent')}
                  className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-colors ${interestedTab === 'sent' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}
                >
                  Sent {myInterestedLists.length > 0 && `(${myInterestedLists.length})`}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {interestedTab === 'current' ? (
                  interestedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
                      <Eye className="h-12 w-12 stroke-[1px]" />
                      <p className="text-[10px] uppercase tracking-widest">No items yet</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {interestedItems.map((item: ClothingItem, idx: number) => (
                        <div key={item.id} className="flex items-center gap-3 group">
                          <span className="text-[10px] font-mono text-gray-400 w-4 shrink-0">{idx + 1}.</span>
                          <div className="w-12 h-14 bg-gray-50 shrink-0 overflow-hidden">
                            <img src={item.representativeImage} alt={item.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-widest truncate">{item.title}</p>
                            <p className="text-[9px] text-gray-400 uppercase tracking-widest truncate">
                              {item.tags.filter((t: string) => allowedTags.includes(t)).join(' / ') || 'CLASSIFIED'}
                            </p>
                            {(item.price ?? 0) > 0 && <p className="text-[11px] font-mono font-bold">${item.price}</p>}
                          </div>
                          <button onClick={() => toggleInterested(item)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  myInterestedLists.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
                      <Inbox className="h-12 w-12 stroke-[1px]" />
                      <p className="text-[10px] uppercase tracking-widest">No lists sent yet</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-5">
                      {myInterestedLists.map((list: any, listIdx: number) => (
                        <div key={list.id} className="border border-gray-100 rounded-sm overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-widest">List #{myInterestedLists.length - listIdx}</p>
                            <div className="text-right">
                              {list.handled_at ? (
                                <p className="text-[9px] font-bold text-green-600 uppercase tracking-wider">✓ Handled</p>
                              ) : (
                                <p className="text-[9px] text-gray-400 font-mono">{new Date(list.sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                              )}
                            </div>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {list.items.map((item: any) => (
                              <div key={item.id} className="flex items-center gap-3 px-4 py-2">
                                <span className="text-[10px] font-mono text-gray-300 w-4 shrink-0">{item.position}.</span>
                                {item.representative_image && (
                                  <div className="w-9 h-11 bg-gray-50 shrink-0 overflow-hidden">
                                    <img src={item.representative_image} alt={item.collection_title} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-widest truncate">{item.collection_title}</p>
                                  {item.price && <p className="text-[10px] font-mono font-bold">${item.price}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {interestedTab === 'current' && interestedItems.length > 0 && (
                <div className="p-6 border-t space-y-3">
                  {interestedSent && (
                    <p className="text-center text-[10px] uppercase tracking-[0.2em] font-bold text-green-600">✓ List sent successfully</p>
                  )}
                  <button
                    onClick={sendInterestedList}
                    disabled={sendingInterested}
                    className="w-full bg-black text-white py-4 text-[11px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-50"
                  >
                    {sendingInterested ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    Send List
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Interested Lists Panel (shoper) */}
      <AnimatePresence>
        {isInterestedListsOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-[200]" onClick={() => setIsInterestedListsOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-[210] flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <h2 className="text-[11px] font-bold uppercase tracking-widest">Inbox</h2>
                </div>
                <button onClick={() => setIsInterestedListsOpen(false)} className="hover:rotate-90 transition-transform p-1 text-gray-300 hover:text-black">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex border-b shrink-0">
                <button onClick={() => setShoperTab('interested')} className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-1.5 ${shoperTab === 'interested' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                  <Eye className="h-3.5 w-3.5" /> Interested {interestedLists.filter((l: any) => !l.handled_at && (isSuperViewer() || !l.my_handled_at)).length > 0 && `(${interestedLists.filter((l: any) => !l.handled_at && (isSuperViewer() || !l.my_handled_at)).length})`}
                </button>
                <button onClick={() => setShoperTab('orders')} className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-1.5 ${shoperTab === 'orders' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                  <ShoppingCart className="h-3.5 w-3.5" /> Orders {cartOrders.filter((o: any) => !o.handled_at).length > 0 && `(${cartOrders.filter((o: any) => !o.handled_at).length})`}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col">
                {shoperTab === 'interested' ? (
                  <>
                  {isSuperViewer() && (
                    <div className="flex border-b shrink-0">
                      <button onClick={() => setMegaInboxTab('open')} className={`flex-1 py-2 text-[9px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-1 ${megaInboxTab === 'open' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                        Open ({interestedLists.filter((l: any) => !l.handled_at).length})
                      </button>
                      <button onClick={() => setMegaInboxTab('history')} className={`flex-1 py-2 text-[9px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-1 ${megaInboxTab === 'history' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                        <Clock className="h-3 w-3" /> History ({interestedLists.filter((l: any) => l.handled_at).length})
                      </button>
                    </div>
                  )}
                  {(() => {
                    const visibleLists = isSuperViewer()
                      ? interestedLists.filter((l: any) => megaInboxTab === 'open' ? !l.handled_at : !!l.handled_at)
                      : interestedLists;
                    return visibleLists.length === 0 ? (
                      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-300">
                        <Eye className="h-12 w-12 stroke-[1px]" />
                        <p className="text-[10px] uppercase tracking-widest">{megaInboxTab === 'history' ? 'No history yet' : 'No lists received yet'}</p>
                      </div>
                    ) : (
                      <div className="p-4 space-y-5 overflow-y-auto">
                        {visibleLists.map((list: any) => (
                          <div key={list.id} className="border border-gray-100 rounded-sm overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-widest">{list.buyer_username}</p>
                                <p className="text-[9px] text-gray-400 font-mono mt-0.5">{new Date(list.sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                              {(() => {
                                const isAlsoShoper = currentUser?.groups?.includes('shopers');
                                if (list.handled_at) return <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">✓ Handled</span>;
                                if (isSuperViewer()) {
                                  if (list.all_shopers_handled) return <button onClick={() => handleInterestedList(list.id)} className="text-[9px] font-bold uppercase tracking-widest border border-black px-3 py-1 hover:bg-black hover:text-white transition-all">Mark Handled</button>;
                                  if (isAlsoShoper && !list.my_handled_at) return <button onClick={() => markShoperHandled(list.id)} className="text-[9px] font-bold uppercase tracking-widest border border-black px-3 py-1 hover:bg-black hover:text-white transition-all">Mark My Part</button>;
                                  if (isAlsoShoper && list.my_handled_at) return <span className="text-[9px] text-gray-400 uppercase tracking-widest">✓ Waiting others…</span>;
                                  return <span className="text-[9px] text-gray-400 uppercase tracking-widest">Waiting shopers…</span>;
                                }
                                return list.my_handled_at
                                  ? <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">✓ Handled</span>
                                  : <button onClick={() => markShoperHandled(list.id)} className="text-[9px] font-bold uppercase tracking-widest border border-black px-3 py-1 hover:bg-black hover:text-white transition-all">Mark Handled</button>;
                              })()}
                            </div>
                            <div className="divide-y divide-gray-50">
                              {list.items.map((item: any) => (
                                <div key={item.id} className="flex items-center gap-3 px-4 py-2">
                                  <span className="text-[9px] font-mono text-gray-300 w-4 shrink-0">{item.position}.</span>
                                  {item.representative_image && <div className="w-9 h-11 shrink-0 overflow-hidden"><img src={item.representative_image} alt={item.collection_title} className="w-full h-full object-cover" /></div>}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-widest truncate">{item.collection_title}</p>
                                    {item.price && <p className="text-[10px] font-mono font-bold">${item.price}</p>}
                                  </div>
                                  {isSuperViewer() && item.uploaded_by && (
                                    list.shoper_handles?.some((h: any) => h.shoper_username === item.uploaded_by)
                                      ? <span className="text-[9px] font-bold text-green-500 shrink-0">✓</span>
                                      : <span className="text-[9px] text-gray-300 shrink-0">○</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  </>
                ) : (
                  <>
                  {isSuperViewer() && (
                    <div className="flex border-b shrink-0">
                      <button onClick={() => setMegaOrdersTab('open')} className={`flex-1 py-2 text-[9px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-1 ${megaOrdersTab === 'open' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                        Open ({cartOrders.filter((o: any) => !o.handled_at).length})
                      </button>
                      <button onClick={() => setMegaOrdersTab('history')} className={`flex-1 py-2 text-[9px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-1 ${megaOrdersTab === 'history' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                        <Clock className="h-3 w-3" /> History ({cartOrders.filter((o: any) => o.handled_at).length})
                      </button>
                    </div>
                  )}
                  {(() => {
                    const visibleOrders = isSuperViewer()
                      ? cartOrders.filter((o: any) => megaOrdersTab === 'open' ? !o.handled_at : !!o.handled_at)
                      : cartOrders;
                    return visibleOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-300">
                        <ShoppingBag className="h-12 w-12 stroke-[1px]" />
                        <p className="text-[10px] uppercase tracking-widest">{megaOrdersTab === 'history' ? 'No history yet' : 'No orders received yet'}</p>
                      </div>
                    ) : (
                      <div className="p-4 space-y-5 overflow-y-auto">
                        {visibleOrders.map((order: any) => (
                          <div key={order.id} className="border border-gray-100 rounded-sm overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-widest">{order.buyer_username}</p>
                                <p className="text-[9px] text-gray-400 font-mono mt-0.5">{new Date(order.sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                              {order.handled_at ? (
                                <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">✓ Handled</span>
                              ) : (
                                <button onClick={() => handleCartOrder(order.id)} className="text-[9px] font-bold uppercase tracking-widest border border-black px-3 py-1 hover:bg-black hover:text-white transition-all">
                                  Mark Handled
                                </button>
                              )}
                            </div>
                            <div className="divide-y divide-gray-50">
                              {order.items.map((item: any) => (
                                <div key={item.id} className="flex items-center gap-3 px-4 py-2">
                                  <span className="text-[9px] font-mono text-gray-300 w-4 shrink-0">{item.position}.</span>
                                  {item.representative_image && <div className="w-9 h-11 shrink-0 overflow-hidden"><img src={item.representative_image} alt={item.collection_title} className="w-full h-full object-cover" /></div>}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-widest truncate">{item.collection_title}</p>
                                    <p className="text-[9px] text-gray-400 font-mono">{item.size} × {item.quantity}</p>
                                  </div>
                                  {item.price && <p className="text-[10px] font-mono font-bold shrink-0">${(item.price * item.quantity).toFixed(0)}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Size Guide Modal */}
      <AnimatePresence>
        {isSizeGuideOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSizeGuideOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="fixed inset-0 m-auto h-fit max-w-sm w-full bg-white z-[210] shadow-2xl p-8 rounded-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-light uppercase tracking-widest">Size Guide</h3>
                <button onClick={() => setIsSizeGuideOpen(false)} className="hover:rotate-90 transition-transform"><X className="h-5 w-5" /></button>
              </div>
              <table className="w-full text-[11px] uppercase tracking-wider">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-bold text-gray-400">Size</th>
                    <th className="text-center py-2 font-bold text-gray-400">Chest (cm)</th>
                    <th className="text-center py-2 font-bold text-gray-400">Waist (cm)</th>
                    <th className="text-center py-2 font-bold text-gray-400">Hips (cm)</th>
                  </tr>
                </thead>
                <tbody>
                  {[['S','80–84','60–64','88–92'],['M','84–88','64–68','92–96'],['L','88–92','68–72','96–100'],['XL','92–96','72–76','100–104']].map(([size,...vals]) => (
                    <tr key={size} className="border-b border-gray-50">
                      <td className="py-2.5 font-bold">{size}</td>
                      {vals.map((v, i) => <td key={i} className="py-2.5 text-center font-mono text-gray-500">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[9px] text-gray-300 uppercase tracking-widest text-center mt-6">Measurements are approximate</p>
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
                      NO: {billOrderNumber} / {new Date().toLocaleDateString()}
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
                          {(item.item.price ?? 0) > 0 && (
                            <p className="text-[9px] font-mono text-gray-400">${((item.item.price ?? 0) * item.quantity).toFixed(0)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-4 mb-6 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase tracking-widest text-gray-400">Total Items</span>
                      <span className="text-xs font-bold font-mono">{cartTotalItems}</span>
                    </div>
                    {(() => {
                      const total = cart.reduce((acc, c) => acc + (c.item.price || 0) * c.quantity, 0);
                      return total > 0 ? (
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] uppercase tracking-widest text-gray-400">Total Price</span>
                          <span className="text-xs font-bold font-mono">${total.toFixed(0)}</span>
                        </div>
                      ) : null;
                    })()}
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

      {/* Admin Panel */}
      <AnimatePresence>
        {isAdminOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300]" onClick={() => { setIsAdminOpen(false); setEditingUser(null); setShowNewUserForm(false); }} />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed left-0 top-0 h-full w-full max-w-md bg-white z-[310] flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-2">
                  <Menu className="h-4 w-4" />
                  <h2 className="text-[11px] font-bold uppercase tracking-widest">Admin Panel</h2>
                </div>
                <button onClick={() => { setIsAdminOpen(false); setEditingUser(null); setShowNewUserForm(false); }} className="hover:rotate-90 transition-transform p-1 text-gray-300 hover:text-black">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex border-b shrink-0">
                <button onClick={() => setAdminTab('users')} className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2 ${adminTab === 'users' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                  <Users className="h-3 w-3" /> Users & Groups
                </button>
                <button onClick={() => setAdminTab('tags')} className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2 ${adminTab === 'tags' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                  <Tag className="h-3 w-3" /> Tags
                </button>
                <button onClick={() => { setAdminTab('orders'); fetchAdminOrders(); }} className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2 ${adminTab === 'orders' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                  <Inbox className="h-3 w-3" /> Orders
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {adminTab === 'users' ? (
                  <div className="flex flex-col">
                    <div className="flex border-b shrink-0 bg-white">
                      <button onClick={() => setUsersGroupsSubTab('groups')} className={`flex-1 py-2.5 text-[9px] uppercase tracking-widest font-bold transition-colors ${usersGroupsSubTab === 'groups' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>Groups</button>
                      <button onClick={() => setUsersGroupsSubTab('users')} className={`flex-1 py-2.5 text-[9px] uppercase tracking-widest font-bold transition-colors ${usersGroupsSubTab === 'users' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>Users</button>
                    </div>
                    {usersGroupsSubTab === 'groups' ? (
                      <div className="p-4 space-y-4">
                        {GROUPS.map(group => {
                          const members = adminUsers.filter((u: typeof adminUsers[0]) => u.groups?.includes(group.value));
                          const nonMembers = adminUsers.filter((u: typeof adminUsers[0]) => !u.groups?.includes(group.value));
                          const isAddingHere = addingToGroup?.group === group.value;
                          return (
                            <div key={group.value} className="border border-gray-100 rounded-sm overflow-hidden">
                              <div className="bg-gray-50 px-4 py-3">
                                <p className="text-[11px] font-bold uppercase tracking-widest">{group.label}</p>
                                <p className="text-[9px] text-gray-400 mt-0.5">{group.permissions.map(p => p.replace(/_/g, ' ')).join(' · ')}</p>
                              </div>
                              <div className="px-4 py-3 space-y-1.5">
                                {members.length === 0 && <p className="text-[9px] text-gray-300 uppercase tracking-widest">No members</p>}
                                {members.map((u: typeof adminUsers[0]) => (
                                  <div key={u.id} className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase tracking-widest font-bold">{u.username}</span>
                                    <button onClick={() => removeUserFromGroup(u.id, group.value)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><X className="h-3 w-3" /></button>
                                  </div>
                                ))}
                                {isAddingHere ? (
                                  <div className="flex gap-1.5 pt-1">
                                    <select value={addingToGroup.userId} onChange={e => setAddingToGroup({ ...addingToGroup, userId: e.target.value })} className="flex-1 border border-gray-200 px-2 py-1.5 text-[10px] uppercase tracking-widest outline-none focus:border-black bg-white">
                                      <option value="">Select user...</option>
                                      {nonMembers.map((u: typeof adminUsers[0]) => <option key={u.id} value={u.id}>{u.username}</option>)}
                                    </select>
                                    <button onClick={async () => { if (addingToGroup.userId) { await addUserToGroup(Number(addingToGroup.userId), group.value); setAddingToGroup(null); } }} className="px-3 py-1.5 bg-black text-white text-[9px] uppercase tracking-widest">Add</button>
                                    <button onClick={() => setAddingToGroup(null)} className="px-3 py-1.5 border border-gray-200 text-[9px] uppercase tracking-widest text-gray-400 hover:text-black">✕</button>
                                  </div>
                                ) : nonMembers.length > 0 && (
                                  <button onClick={() => setAddingToGroup({ group: group.value, userId: '' })} className="w-full border border-dashed border-gray-200 py-1.5 text-[9px] uppercase tracking-widest text-gray-400 hover:text-black hover:border-black transition-all flex items-center justify-center gap-1 mt-1">
                                    <Plus className="h-2.5 w-2.5" /> Add Member
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                    <div className="p-4 space-y-4">
                    {adminUsers.map((user: typeof adminUsers[0]) => (
                      <div key={user.id} className="border border-gray-100 rounded-sm overflow-hidden">
                        {editingUser?.id === user.id ? (
                          <div className="p-4 space-y-3">
                            <input
                              value={editingUser.username}
                              onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                              placeholder="Username"
                              className="w-full border border-gray-200 px-3 py-2 text-[11px] uppercase tracking-widest outline-none focus:border-black"
                            />
                            <input
                              value={editingUser.password}
                              onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                              placeholder="New password (leave blank to keep)"
                              type="password"
                              className="w-full border border-gray-200 px-3 py-2 text-[11px] tracking-widest outline-none focus:border-black"
                            />
                            <div className="space-y-1.5">
                              <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Group</p>
                              <div className="flex flex-wrap gap-1.5">
                                {GROUPS.map(g => (
                                  <button key={g.value}
                                    onClick={() => setEditingUser({ ...editingUser, groups: editingUser.groups.includes(g.value) ? [] : [g.value] })}
                                    className={`px-2 py-1 text-[9px] uppercase tracking-widest border transition-all ${editingUser.groups.includes(g.value) ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-400 hover:border-gray-400'}`}
                                  >{g.label}</button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Extra Permissions</p>
                              <div className="flex flex-wrap gap-1.5">
                                {ALL_PERMISSIONS.map(p => {
                                  const inGroup = editingUser.groups.some((g: string) => GROUPS.find((x: { value: string; permissions: string[] }) => x.value === g)?.permissions.includes(p));
                                  return (
                                    <button key={p}
                                      disabled={inGroup}
                                      onClick={() => {
                                        const perms = editingUser.permissions.includes(p) ? editingUser.permissions.filter(x => x !== p) : [...editingUser.permissions, p];
                                        setEditingUser({ ...editingUser, permissions: perms });
                                      }}
                                      className={`px-2 py-1 text-[9px] uppercase tracking-widest border transition-all ${inGroup ? 'border-gray-100 text-gray-300 cursor-default' : editingUser.permissions.includes(p) ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-400 hover:border-gray-400'}`}
                                    >{p.replace(/_/g, ' ')}{inGroup ? ' ✓' : ''}</button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={updateAdminUser} className="flex-1 bg-black text-white py-2 text-[10px] uppercase tracking-widest font-bold hover:bg-gray-800 transition-colors">Save</button>
                              <button onClick={() => setEditingUser(null)} className="flex-1 border border-gray-200 py-2 text-[10px] uppercase tracking-widest text-gray-400 hover:text-black hover:border-black transition-all">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className={`px-4 py-3 flex items-center justify-between ${user.locked ? 'bg-red-50/50' : ''}`}>
                            <div>
                              <p className={`text-[11px] font-bold uppercase tracking-widest ${user.locked ? 'text-red-400' : ''}`}>{user.username}</p>
                              <p className="text-[9px] text-gray-400 mt-0.5">
                                {user.groups?.length > 0
                                  ? user.groups.map((g: string) => GROUPS.find((x: { value: string; label: string }) => x.value === g)?.label || g).join(', ')
                                  : 'No group'}
                                {user.permissions?.length > 0 && <span className="ml-1 text-gray-300">+ {user.permissions.length} extra</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              {user.username !== 'admin' && (
                                <button
                                  onClick={() => toggleUserLock(user.id)}
                                  className="flex items-center gap-1.5 group"
                                  title={user.locked ? 'Enable user' : 'Disable user'}
                                >
                                  <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${user.locked ? 'text-red-400' : 'text-green-500'}`}>
                                    {user.locked ? 'Disabled' : 'Active'}
                                  </span>
                                  <div className={`relative w-7 h-4 rounded-full transition-colors ${user.locked ? 'bg-red-300' : 'bg-green-400'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${user.locked ? 'left-0.5' : 'left-3.5'}`} />
                                  </div>
                                </button>
                              )}
                              <button onClick={() => setEditingUser({ ...user, password: '' })} className="p-1 text-gray-300 hover:text-black transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                              {user.username !== 'admin' && (
                                <button onClick={() => deleteAdminUser(user.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {showNewUserForm ? (
                      <div className="border border-dashed border-gray-200 rounded-sm p-4 space-y-3">
                        <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">New User</p>
                        <input
                          value={newUserForm.username}
                          onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })}
                          placeholder="Username"
                          className="w-full border border-gray-200 px-3 py-2 text-[11px] uppercase tracking-widest outline-none focus:border-black"
                        />
                        <input
                          value={newUserForm.password}
                          onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
                          placeholder="Password"
                          type="password"
                          className="w-full border border-gray-200 px-3 py-2 text-[11px] tracking-widest outline-none focus:border-black"
                        />
                        <div className="space-y-1.5">
                          <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Extra Permissions</p>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_PERMISSIONS.map(p => {
                              const inGroup = newUserForm.groups.some((g: string) => GROUPS.find((x: { value: string; permissions: string[] }) => x.value === g)?.permissions.includes(p));
                              return (
                                <button key={p}
                                  disabled={inGroup}
                                  onClick={() => {
                                    const perms = newUserForm.permissions.includes(p) ? newUserForm.permissions.filter(x => x !== p) : [...newUserForm.permissions, p];
                                    setNewUserForm({ ...newUserForm, permissions: perms });
                                  }}
                                  className={`px-2 py-1 text-[9px] uppercase tracking-widest border transition-all ${inGroup ? 'border-gray-100 text-gray-300 cursor-default' : newUserForm.permissions.includes(p) ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-400 hover:border-gray-400'}`}
                                >{p.replace(/_/g, ' ')}{inGroup ? ' ✓' : ''}</button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={createAdminUser} className="flex-1 bg-black text-white py-2 text-[10px] uppercase tracking-widest font-bold hover:bg-gray-800 transition-colors">Create</button>
                          <button onClick={() => { setShowNewUserForm(false); setNewUserForm({ username: '', password: '', permissions: [] }); }} className="flex-1 border border-gray-200 py-2 text-[10px] uppercase tracking-widest text-gray-400 hover:text-black hover:border-black transition-all">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowNewUserForm(true)} className="w-full border border-dashed border-gray-200 py-3 text-[10px] uppercase tracking-widest text-gray-400 hover:text-black hover:border-black transition-all flex items-center justify-center gap-2">
                        <Plus className="h-3 w-3" /> Add User
                      </button>
                    )}
                    </div>
                    )}
                  </div>
                ) : adminTab === 'tags' ? (
                  <div className="p-4 space-y-4">
                    <div className="space-y-2">
                      {allowedTags.map(tag => (
                        <div key={tag} className="flex items-center justify-between px-4 py-2.5 border border-gray-100 rounded-sm">
                          <span className="text-[11px] font-bold uppercase tracking-widest">{tag}</span>
                          <button onClick={() => removeAdminTag(tag)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newTagInput}
                        onChange={e => setNewTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addAdminTag(); }}
                        placeholder="New tag name..."
                        className="flex-1 border border-gray-200 px-3 py-2 text-[11px] uppercase tracking-widest outline-none focus:border-black"
                      />
                      <button onClick={addAdminTag} className="px-4 bg-black text-white text-[10px] uppercase tracking-widest font-bold hover:bg-gray-800 transition-colors">
                        Add
                      </button>
                    </div>
                  </div>
                ) : adminTab === 'orders' ? (() => {
                  const pendingInterested = interestedLists.filter((l: any) => !l.handled_at);
                  const pendingCart = cartOrders.filter((o: any) => !o.handled_at);
                  const handledInterested = interestedLists.filter((l: any) => l.handled_at);
                  const handledCart = cartOrders.filter((o: any) => o.handled_at);
                  const renderItems = (items: any[], isCart: boolean) => items.map((entry: any) => (
                    <div key={entry.id} className="border border-gray-100 rounded-sm overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest">{entry.buyer_username}</p>
                          <p className="text-[9px] text-gray-400 font-mono mt-0.5">{new Date(entry.sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        {entry.handled_at && <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">✓ Handled</span>}
                      </div>
                      <div className="divide-y divide-gray-50">
                        {entry.items.map((item: any) => (
                          <div key={item.id} className="flex items-center gap-3 px-4 py-2">
                            <span className="text-[9px] font-mono text-gray-300 w-4 shrink-0">{item.position}.</span>
                            {item.representative_image && <div className="w-8 h-10 shrink-0 overflow-hidden"><img src={item.representative_image} alt={item.collection_title} className="w-full h-full object-cover" /></div>}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-widest truncate">{item.collection_title}</p>
                              {isCart ? <p className="text-[9px] text-gray-400 font-mono">{item.size} × {item.quantity}</p> : item.price && <p className="text-[9px] font-mono text-gray-400">${item.price}</p>}
                            </div>
                            {isCart && item.price && <p className="text-[9px] font-mono font-bold shrink-0">${(item.price * item.quantity).toFixed(0)}</p>}
                            {!isCart && item.uploaded_by && (
                              entry.shoper_handles?.some((h: any) => h.shoper_username === item.uploaded_by)
                                ? <span className="text-[9px] font-bold text-green-500 shrink-0">✓</span>
                                : <span className="text-[9px] text-gray-300 shrink-0">○</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                  return (
                    <div className="flex flex-col h-full">
                      <div className="flex border-b shrink-0">
                        <button onClick={() => setAdminOrdersTab('interested')} className={`flex-1 py-2.5 text-[9px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-1 ${adminOrdersTab === 'interested' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                          <Eye className="h-3 w-3" /> Interested {pendingInterested.length > 0 && `(${pendingInterested.length})`}
                        </button>
                        <button onClick={() => setAdminOrdersTab('cart')} className={`flex-1 py-2.5 text-[9px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-1 ${adminOrdersTab === 'cart' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                          <ShoppingCart className="h-3 w-3" /> Cart {pendingCart.length > 0 && `(${pendingCart.length})`}
                        </button>
                        <button onClick={() => setAdminOrdersTab('history')} className={`flex-1 py-2.5 text-[9px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-1 ${adminOrdersTab === 'history' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>
                          <Clock className="h-3 w-3" /> History {(handledInterested.length + handledCart.length) > 0 && `(${handledInterested.length + handledCart.length})`}
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {adminOrdersTab === 'interested' ? (
                          pendingInterested.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 gap-3 text-gray-300">
                              <Eye className="h-8 w-8 stroke-[1px]" />
                              <p className="text-[9px] uppercase tracking-widest">No open interested lists</p>
                            </div>
                          ) : renderItems(pendingInterested, false)
                        ) : adminOrdersTab === 'cart' ? (
                          pendingCart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 gap-3 text-gray-300">
                              <ShoppingCart className="h-8 w-8 stroke-[1px]" />
                              <p className="text-[9px] uppercase tracking-widest">No open cart orders</p>
                            </div>
                          ) : renderItems(pendingCart, true)
                        ) : (
                          (handledInterested.length + handledCart.length) === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 gap-3 text-gray-300">
                              <Clock className="h-8 w-8 stroke-[1px]" />
                              <p className="text-[9px] uppercase tracking-widest">No handled orders yet</p>
                            </div>
                          ) : (
                            <>
                              {handledInterested.length > 0 && (
                                <div className="space-y-3">
                                  <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold flex items-center gap-1.5"><Eye className="h-3 w-3" /> Interested</p>
                                  {renderItems(handledInterested, false)}
                                </div>
                              )}
                              {handledCart.length > 0 && (
                                <div className="space-y-3">
                                  <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold flex items-center gap-1.5"><ShoppingCart className="h-3 w-3" /> Cart Orders</p>
                                  {renderItems(handledCart, true)}
                                </div>
                              )}
                            </>
                          )
                        )}
                      </div>
                    </div>
                  );
                })() : null}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
