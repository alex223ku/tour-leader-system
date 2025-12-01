/**
 * 翔慶旅行社領隊系統 V68 - Transpiled to Pure JavaScript
 * 此檔案是將所有 JSX 程式碼轉換為 React.createElement 呼叫，以便提高運行速度。
 * 請確保搭配優化後的 index.html 檔案一起使用。
 */

const { useState, useEffect, createElement: e, Fragment } = React;

// --- 系統常數與初始化設定 ---
const LOCAL_STORAGE_KEY = 'xiangqing_v68_data';
const FIREBASE_CONFIG_KEY = 'xiangqing_firebase_config';
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-tour-app'; // 使用全局變數或預設值

const INITIAL_DATA = {
    leaders: [
        { id: 'L1', name: '王小明', username: '11301', password: '1234', group: 'G-1128', busId: 'bus_A' },
        { id: 'L2', name: '陳大華', username: '11302', password: '1234', group: 'G-1128', busId: 'bus_B' },
        { id: 'L3', name: '林美麗', username: '11303', password: '1234', group: 'G-1128', busId: 'bus_C' },
    ],
    tours: {
        'bus_A': { busName: "A車 (王小明)", members: [{ id: 'm1', name: '張三', phone: '0912345678' }], boardedIds: [] },
        'bus_B': { busName: "B車 (陳大華)", members: [], boardedIds: [] },
        'bus_C': { busName: "C車 (林美麗)", members: [], boardedIds: [] },
    },
    adminPassword: 'admin888',
    systemUrl: ''
};

let db = null;
let auth = null;
let isCloudReady = false;

// --- 1. 自動偵測網址中的設定碼 (Magic Link Handler) ---
try {
    const params = new URLSearchParams(window.location.search);
    const setupCode = params.get('setup');
    if (setupCode) {
        try {
            const configStr = atob(setupCode);
            const config = JSON.parse(configStr);
            localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
            window.history.replaceState({}, document.title, window.location.pathname);
            // 使用自定義模態框代替 alert
            showModalMessage("🎉 雲端設定已自動匯入！", "系統將連接至資料庫並自動重啟。");
            setTimeout(() => window.location.reload(), 1500);
        } catch(e) {
            console.error("設定碼無效", e);
        }
    }
} catch(e) {}

// --- 2. 初始化 Firebase ---
try {
    const savedConfig = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        if (typeof firebase !== 'undefined' && !firebase.apps.length) {
             firebase.initializeApp(config);
             db = firebase.firestore();
             auth = firebase.auth();
             isCloudReady = true;
             // 啟用 Firestore 偵錯日誌
             if (db) db.settings({ experimentalForceLongPolling: true });
        }
    }
} catch (e) {
    console.error("Firebase Init Error", e);
}

// Custom Modal Message (取代 alert/confirm)
function showModalMessage(title, message, isConfirm = false, onConfirm = () => {}) {
    const existingModal = document.getElementById('custom-modal');
    if (existingModal) existingModal.remove();

    const modalDiv = document.createElement('div');
    modalDiv.id = 'custom-modal';
    modalDiv.className = 'fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm text-center text-gray-900';
    
    contentDiv.innerHTML = `
        <h3 class="text-xl font-bold mb-3">${title}</h3>
        <p class="text-gray-600 mb-6 text-sm">${message}</p>
        <div class="flex gap-3">
            ${isConfirm ? `<button id="modal-cancel" class="flex-1 bg-gray-200 py-3 rounded-lg font-bold">取消</button>` : ''}
            <button id="modal-confirm" class="flex-1 ${isConfirm ? 'bg-red-500' : 'bg-blue-600'} text-white py-3 rounded-lg font-bold">
                ${isConfirm ? '確定' : '我知道了'}
            </button>
        </div>
    `;

    modalDiv.appendChild(contentDiv);
    document.body.appendChild(modalDiv);

    document.getElementById('modal-confirm').onclick = () => {
        modalDiv.remove();
        onConfirm();
    };

    if (isConfirm) {
        document.getElementById('modal-cancel').onclick = () => modalDiv.remove();
    }
}

// Helper component for icons
const Icon = ({ i, className = "" }) => e("span", {
    className: `inline-block mr-1 align-middle text-xl ${className}`
}, i);

function App() {
    const [view, setView] = useState('landing');
    const [isCloud, setIsCloud] = useState(isCloudReady);
    const [leaders, setLeaders] = useState(INITIAL_DATA.leaders);
    const [tours, setTours] = useState(INITIAL_DATA.tours);
    const [identity, setIdentity] = useState(null);
    const [viewingBusId, setViewingBusId] = useState(null);
    const [inputs, setInputs] = useState({ user: '', pass: '', adminPass: '', bulk: '', memberPhone: '', firebase: '' });
    const [modal, setModal] = useState(null);
    const [selectedMember, setSelectedMember] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    // Init & Auth (for Cloud mode)
    useEffect(() => {
        const init = async () => {
            if (isCloud && auth && db) {
                try {
                    await auth.signInAnonymously();
                    // Listen for leaders configuration
                    db.collection('nas_apps').doc(APP_ID).collection('config').doc('main').onSnapshot(doc => {
                        if (doc.exists) setLeaders(doc.data().leaders);
                        else db.collection('nas_apps').doc(APP_ID).collection('config').doc('main').set({ leaders: INITIAL_DATA.leaders });
                    }, (error) => {
                        console.error("Firestore Leader Sync Error:", error);
                        setIsCloud(false);
                    });
                } catch(e) {
                    console.error("Firebase Sign In Error:", e);
                    setIsCloud(false);
                }
            }
            // Load from Local Storage (for Local mode fallback)
            if (!isCloud) {
                const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setLeaders(parsed.leaders || INITIAL_DATA.leaders);
                    setTours(parsed.tours || INITIAL_DATA.tours);
                }
            }
        };
        init();
    }, [isCloud]);

    // Tour Data Sync (Cloud only, once viewingBusId is set)
    useEffect(() => {
        if (!isCloud || !viewingBusId || !db) return;
        
        const tourRef = db.collection('nas_apps').doc(APP_ID).collection('tours').doc(viewingBusId);

        const unsub = tourRef.onSnapshot(doc => {
            if (doc.exists) {
                setTours(prev => ({ ...prev, [viewingBusId]: doc.data() }));
            } else {
                // Initialize the tour data if it doesn't exist
                const initial = tours[viewingBusId] || { busName: viewingBusId, members: [], boardedIds: [] };
                tourRef.set(initial);
            }
        }, (error) => {
            console.error("Firestore Tour Sync Error:", error);
            // Do not break the app, but log the error
        });

        return () => unsub();
    }, [isCloud, viewingBusId]);

    // Local Storage Sync (Local mode only)
    useEffect(() => {
        if (!isCloud) localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ leaders, tours }));
    }, [leaders, tours, isCloud]);


    // --- Core Logic Functions ---

    const updateBusData = async (busId, newData) => {
        if (identity.role === 'leader' && identity.busId !== busId) return showModalMessage("權限不足", "您只能操作您所負責的車次。");
        
        // Optimistic update for UI
        setTours(prev => ({ ...prev, [busId]: { ...prev[busId], ...newData } }));
        
        if (isCloud && db) {
            try {
                await db.collection('nas_apps').doc(APP_ID).collection('tours').doc(busId).update(newData);
            } catch(e) {
                console.error("Cloud Update Error", e);
                showModalMessage("雲端寫入失敗", "資料庫連線或寫入發生錯誤，請檢查網路。");
                // Optional: Revert local state if cloud write fails
            }
        }
    };

    const toggleBoarding = (busId, memberId, isBoarding) => {
        const bus = tours[busId];
        let newBoarded = [...bus.boardedIds];

        if (isBoarding) {
            if (!newBoarded.includes(memberId)) newBoarded.push(memberId);
        } else {
            newBoarded = newBoarded.filter(id => id !== memberId);
        }

        if (isCloud && db) {
            const ref = db.collection('nas_apps').doc(APP_ID).collection('tours').doc(busId);
            const firestore = firebase.firestore;
            ref.update({
                boardedIds: isBoarding ? firestore.FieldValue.arrayUnion(memberId) : firestore.FieldValue.arrayRemove(memberId)
            });
            // State will be updated by onSnapshot listener
        } else {
            updateBusData(busId, { boardedIds: newBoarded });
        }
    };

    const handleImport = () => {
        if (!inputs.bulk || !viewingBusId) return;
        const lines = inputs.bulk.split(/\n/);
        const newMembers = lines.map((l, i) => {
            const parts = l.trim().split(/[\s,]+/);
            const n = parts[0];
            const p = parts.length > 1 ? parts.slice(1).join('') : ''; // Join remaining parts for phone
            if (n) return { id: `m_${Date.now()}_${i}`, name: n, phone: p.replace(/\D/g,'') }; // Clean phone number
            return null;
        }).filter(x => x);
        
        const bus = tours[viewingBusId];
        updateBusData(viewingBusId, { members: [...bus.members, ...newMembers] });
        setInputs({ ...inputs, bulk: '' });
        setModal(null);
        showModalMessage("匯入成功", `成功匯入 ${newMembers.length} 人`);
    };

    const handleMemberVerify = () => {
        if (!viewingBusId) return;
        const bus = tours[viewingBusId];
        const code = inputs.memberPhone;
        if (!code || code.length !== 3) return showModalMessage("錯誤", "請輸入完整的手機末 3 碼。");
        
        // Find member whose phone number ends with the 3-digit code
        const member = bus.members.find(m => m.phone && m.phone.endsWith(code));
        
        if (member) {
            if (bus.boardedIds.includes(member.id)) {
                showModalMessage("已報到", `${member.name} 已經報到過了，無需重複操作。`, false);
            } else {
                toggleBoarding(viewingBusId, member.id, true);
                showModalMessage("報到成功", `歡迎 ${member.name} 上車！`, false);
                setInputs({ ...inputs, memberPhone: '' });
                // setModal(null); // Keep modal for continuous scanning
            }
        } else {
            showModalMessage("驗證失敗", "找不到此手機末 3 碼的團員，請洽領隊確認。");
        }
    };

    const saveFirebaseConfig = () => {
        try {
            const config = JSON.parse(inputs.firebase);
            localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
            showModalMessage("設定儲存成功", "系統需要重啟以應用新的雲端設定。", false, () => window.location.reload());
        } catch(e) {
            showModalMessage("格式錯誤", "請確認您貼上的是正確的 Firebase Config JSON 格式。");
        }
    };

    const generateMagicLink = () => {
        const currentConfig = localStorage.getItem(FIREBASE_CONFIG_KEY);
        if (!currentConfig) return showModalMessage("功能受限", "請先在上方貼上 Firebase Config 啟用雲端功能，才能產生分享連結！");
        
        const setupCode = btoa(currentConfig);
        const baseUrl = window.location.href.split('?')[0];
        const magicUrl = `${baseUrl}?setup=${setupCode}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(magicUrl).then(() => {
                showModalMessage("✅ 魔術連結已複製", "請將此連結傳給領隊/團員，他們點開後就會自動連線到雲端資料庫，完全不用手動設定！");
            }).catch(() => {
                 showModalMessage("複製失敗", "您的瀏覽器不允許自動複製，請手動複製以下連結：", false, () => {
                    prompt("請手動複製此魔術連結:", magicUrl);
                });
            });
        } else {
            prompt("請手動複製此魔術連結:", magicUrl);
        }
    };

    // --- Component Views (Converted from JSX to React.createElement) ---

    // 1. Landing View
    const LandingView = e("div", {
        className: "min-h-screen flex flex-col items-center justify-center p-6 bg-gray-900 text-white"
    }, 
        e("h1", { className: "text-4xl font-bold mb-4" }, "翔慶旅行社"),
        e("div", { 
            className: `px-4 py-1 rounded-full text-xs font-bold mb-10 ${isCloud ? 'bg-green-600' : 'bg-orange-500'}` 
        }, isCloud ? e(Fragment, null, e(Icon, { i: "☁️" }), " 雲端連線版 V68") : e(Fragment, null, e(Icon, { i: "💾" }), " 本機單機版 V68")),
        e("div", {
            className: "w-full max-w-xs space-y-4"
        }, 
            // Leader Login Card
            e("div", { className: "bg-gray-800 p-6 rounded-2xl border border-gray-700 card-shadow" }, 
                e("h2", { className: "text-xl font-bold mb-4 flex items-center gap-2" }, e(Icon, { i: "🧢" }), " 領隊登入"),
                e("input", {
                    value: inputs.user,
                    onChange: e => setInputs({ ...inputs, user: e.target.value }),
                    className: "w-full bg-gray-900 border border-gray-600 p-3 rounded-lg mb-3 text-white focus:ring-blue-500 focus:border-blue-500",
                    placeholder: "帳號",
                    autoCapitalize: "off"
                }),
                e("input", {
                    type: "password",
                    value: inputs.pass,
                    onChange: e => setInputs({ ...inputs, pass: e.target.value }),
                    className: "w-full bg-gray-900 border border-gray-600 p-3 rounded-lg mb-4 text-white focus:ring-blue-500 focus:border-blue-500",
                    placeholder: "密碼"
                }),
                e("button", {
                    onClick: () => {
                        const cleanUser = inputs.user.trim().toLowerCase();
                        const cleanPass = inputs.pass.trim();
                        const l = leaders.find(x => (x.username.toLowerCase() === cleanUser || x.name === cleanUser) && x.password === cleanPass);
                        if (l) {
                            setIdentity({ role: 'leader', ...l });
                            setViewingBusId(l.busId);
                            setView('dashboard');
                        } else showModalMessage("登入失敗", "帳號或密碼錯誤，請檢查後重試。");
                    },
                    className: "w-full bg-blue-600 py-3 rounded-lg font-bold text-white hover:bg-blue-700 active:scale-[0.98] transition-transform shadow-lg"
                }, "登入")
            ),
            // Member Scan Button
            e("button", {
                onClick: () => {
                    setViewingBusId('bus_A'); // Default to A bus for member scan simulation
                    setIdentity({ role: 'member' });
                    setView('member_scan');
                },
                className: "w-full bg-white text-gray-900 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-gray-100 active:scale-[0.98] transition-transform"
            }, e(Icon, { i: "📷", className: "mr-0" }), " 團員掃碼模擬"),
            // Admin Link
            e("div", { className: "text-center mt-4" }, 
                e("span", {
                    onClick: () => setView('admin_login'),
                    className: "text-gray-500 text-xs underline cursor-pointer hover:text-gray-300 transition-colors"
                }, "管理員後台")
            )
        )
    );

    // 2. Admin Login View
    const AdminLoginView = e("div", {
        className: "min-h-screen bg-gray-800 flex items-center justify-center p-6 text-gray-900"
    }, 
        e("div", { className: "bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl" }, 
            e("h2", { className: "text-2xl font-bold mb-4 text-center text-gray-800" }, "管理者登入"),
            e("div", { className: "relative mb-6" }, 
                e("input", {
                    type: showPassword ? "text" : "password",
                    value: inputs.adminPass,
                    onChange: e => setInputs({ ...inputs, adminPass: e.target.value }),
                    className: "w-full border-2 border-gray-300 p-4 rounded-xl text-lg focus:border-blue-500 outline-none",
                    placeholder: "請輸入 admin888",
                    autoCapitalize: "off"
                }),
                e("button", {
                    onClick: () => setShowPassword(!showPassword),
                    className: "absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-2 text-xl"
                }, showPassword ? '👁️' : '🙈')
            ),
            e("button", {
                onClick: () => {
                    if (inputs.adminPass.trim().toLowerCase() === INITIAL_DATA.adminPassword) {
                        setIdentity({ role: 'admin' });
                        setView('admin_panel');
                    } else showModalMessage("登入失敗", "密碼錯誤。");
                },
                className: "w-full bg-gray-800 text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-700 active:scale-[0.98] transition-transform shadow-lg"
            }, "登入"),
            e("button", {
                onClick: () => setView('landing'),
                className: "w-full mt-4 text-gray-500 py-2 hover:text-gray-700"
            }, "取消")
        )
    );

    // 3. Dashboard View
    const DashboardView = () => {
        const bus = tours[viewingBusId] || { busName: 'Loading...', members: [], boardedIds: [] };
        const pending = bus.members.filter(m => !bus.boardedIds.includes(m.id));
        const boarded = bus.members.filter(m => bus.boardedIds.includes(m.id));
        const isMyBus = identity && identity.busId === viewingBusId;
        const isReady = bus.busName !== 'Loading...';

        return e("div", {
            className: "flex flex-col h-screen bg-gray-100 text-gray-900"
        }, 
            // Header
            e("div", { className: "bg-white p-3 shadow z-10 flex justify-between items-center sticky top-0" }, 
                e("div", { className: "flex items-center gap-2" }, 
                    e("button", {
                        onClick: () => { setIdentity(null); setView('landing'); },
                        className: "border border-gray-300 p-2 rounded text-xl text-gray-600 hover:bg-gray-100 active:scale-95"
                    }, "🚪"),
                    e("div", null, 
                        e("div", { className: "text-xs text-gray-500" }, identity && identity.name),
                        e("div", { className: "font-bold text-xl" }, bus.busName)
                    )
                ),
                isMyBus ? e("div", { className: "flex gap-2" }, 
                    e("button", {
                        onClick: () => setModal('qr'),
                        className: "bg-gray-800 text-white py-2 px-3 rounded flex items-center gap-1 text-sm font-bold active:scale-95 transition-transform"
                    }, e(Icon, { i: "📱", className: "mr-0" })),
                    e("button", {
                        onClick: () => setModal('add'),
                        className: "bg-blue-600 text-white py-2 px-3 rounded flex items-center gap-1 text-sm font-bold active:scale-95 transition-transform"
                    }, e(Icon, { i: "➕", className: "mr-0" })),
                    e("button", {
                        onClick: () => setModal('reset'),
                        className: "bg-orange-100 text-orange-600 py-2 px-3 rounded text-xl active:scale-95 transition-transform"
                    }, "🔄")
                ) : e("div", {
                    className: "bg-yellow-100 text-yellow-800 text-xs py-1 px-2 rounded font-semibold"
                }, e(Icon, { i: "👁️", className: "mr-0" }), " 唯讀")
            ),
            // Stats Bar
            isReady && e("div", { className: "grid grid-cols-3 text-center py-2 bg-white border-t border-gray-200 text-sm shadow-md" }, 
                e("div", null, "應到 ", e("span", { className: "block text-lg font-bold" }, bus.members.length)),
                e("div", { className: "text-green-600" }, "已到 ", e("span", { className: "block text-lg font-bold" }, bus.boardedIds.length)),
                e("div", { className: "text-red-500" }, "未到 ", e("span", { className: "block text-lg font-bold" }, pending.length))
            ),
            // Content
            e("div", { className: "flex-1 overflow-y-auto p-4" }, 
                // Pending List
                e("div", { className: "mb-6" }, 
                    e("h3", { className: "text-gray-500 font-bold mb-3 text-sm border-b pb-1" }, e(Icon, { i: "⚠️" }), " 未上車 (點擊操作)"),
                    e("div", { className: "grid grid-cols-3 gap-3" }, 
                        pending.map(m => e("div", {
                            key: m.id,
                            onClick: () => {
                                if (!isMyBus) return showModalMessage("權限不足", "您只能查看自己的車次，無法操作報到。");
                                setSelectedMember(m);
                                setModal('member_action');
                            },
                            className: "bg-yellow-50 border-2 border-yellow-300 rounded-xl p-2 min-h-[70px] flex flex-col items-center justify-center text-center shadow-sm relative active:scale-[0.98] transition-transform cursor-pointer hover:bg-yellow-100"
                        }, 
                            e("span", { className: "font-bold text-lg leading-tight text-gray-800" }, m.name),
                            m.phone && e("span", { className: "text-[10px] text-blue-500 mt-1" }, "📞 ", m.phone.slice(-4)) // Show last 4 digits
                        ))
                    ),
                    pending.length === 0 && bus.members.length > 0 && e("div", { className: "text-center py-8 text-green-600 font-bold text-xl bg-white rounded-xl shadow-inner mt-4" }, "🎉 全員到齊 🎉")
                ),
                // Boarded List
                boarded.length > 0 && e("div", null, 
                    e("h3", { className: "text-green-600 font-bold mb-3 text-sm border-b pb-1" }, e(Icon, { i: "✅" }), " 已上車 (點擊取消)"),
                    e("div", { className: "grid grid-cols-3 gap-3" }, 
                        boarded.map(m => e("div", {
                            key: m.id,
                            onClick: () => {
                                if (!isMyBus) return;
                                showModalMessage("取消報到", `確定要取消 ${m.name} 的報到嗎？`, true, () => {
                                    toggleBoarding(viewingBusId, m.id, false);
                                });
                            },
                            className: "bg-green-600 text-white rounded-xl p-2 min-h-[70px] flex flex-col items-center justify-center text-center shadow active:scale-[0.98] transition-transform cursor-pointer hover:bg-green-700"
                        }, 
                            e("span", { className: "font-bold text-lg" }, m.name)
                        ))
                    )
                )
            ),
            // --- Modals ---
            // Member Action Modal
            modal === 'member_action' && selectedMember && e("div", {
                className: "fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-6",
                onClick: () => setModal(null)
            }, e("div", {
                className: "bg-white w-full max-w-sm rounded-2xl p-6 text-center text-gray-900 shadow-2xl",
                onClick: e => e.stopPropagation()
            }, 
                e("h3", { className: "text-3xl font-bold mb-2 text-gray-800" }, selectedMember.name),
                e("p", { className: "text-red-500 mb-6 font-semibold" }, "尚未上車"),
                selectedMember.phone ? e("a", {
                    href: `tel:${selectedMember.phone}`,
                    className: "block w-full bg-green-500 text-white py-4 rounded-xl font-bold text-xl mb-3 shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform no-underline"
                }, e(Icon, { i: "📞", className: "mr-0" }), " 撥打電話 ", e("span", { className: "text-base font-normal opacity-80" }, `(${selectedMember.phone})`)) : 
                e("div", { className: "bg-gray-100 text-gray-400 py-3 rounded-xl mb-3 text-sm" }, "無電話資料"), 
                e("button", {
                    onClick: () => {
                        toggleBoarding(viewingBusId, selectedMember.id, true);
                        setModal(null);
                    },
                    className: "w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg mb-3 shadow active:scale-[0.98] transition-transform"
                }, "確認報到 (上車)"),
                e("button", {
                    onClick: () => showModalMessage("確認刪除", "確定要永久刪除此團員資料嗎？", true, () => {
                        updateBusData(viewingBusId, {
                            members: bus.members.filter(x => x.id !== selectedMember.id)
                        });
                        setModal(null);
                    }),
                    className: "w-full border border-red-300 text-red-500 py-3 rounded-xl font-bold text-sm hover:bg-red-50"
                }, "刪除人員"),
                e("button", {
                    onClick: () => setModal(null),
                    className: "w-full mt-4 text-gray-500 py-2"
                }, "關閉")
            )),
            // QR Code Modal
            modal === 'qr' && e("div", {
                className: "fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6",
                onClick: () => setModal(null)
            }, e("div", {
                className: "bg-white p-6 rounded-2xl text-center w-full max-w-sm text-gray-900 shadow-2xl",
                onClick: e => e.stopPropagation()
            }, 
                e("h3", { className: "text-2xl font-bold mb-4 text-gray-800" }, bus.busName),
                e("img", {
                    src: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.href)}`,
                    className: "w-full h-auto border-4 border-gray-200 rounded-xl mb-4"
                }),
                e("p", { className: "text-sm text-gray-500" }, "請團員掃描此碼使用「團員掃碼模擬」報到"),
                e("button", {
                    onClick: () => setModal(null),
                    className: "mt-4 w-full bg-gray-100 py-3 rounded-lg font-bold hover:bg-gray-200"
                }, "關閉")
            )),
            // Add Member Modal
            modal === 'add' && e("div", {
                className: "fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4",
                onClick: () => setModal(null)
            }, e("div", {
                className: "bg-white p-6 rounded-2xl w-full max-w-sm text-gray-900",
                onClick: e => e.stopPropagation()
            }, 
                e("h3", { className: "font-bold text-xl mb-2" }, "批量匯入名單"),
                e("p", { className: "text-xs text-slate-500 mb-2" }, "格式：姓名 電話 (例如：王小明 0912345678)"),
                e("textarea", {
                    value: inputs.bulk,
                    onChange: e => setInputs({ ...inputs, bulk: e.target.value }),
                    className: "w-full border border-gray-300 p-2 h-32 rounded-lg mb-4 text-sm bg-gray-50 focus:border-blue-500",
                    placeholder: "王小明 0912345678\n陳大華 0920111222"
                }),
                e("div", { className: "flex gap-2" }, 
                    e("button", {
                        onClick: handleImport,
                        className: "flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 active:scale-[0.98] transition-transform"
                    }, "匯入"),
                    e("button", {
                        onClick: () => setModal(null),
                        className: "flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-bold hover:bg-gray-300"
                    }, "取消")
                )
            )),
            // Reset Modal
            modal === 'reset' && e("div", {
                className: "fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4",
                onClick: () => setModal(null)
            }, e("div", {
                className: "bg-white p-6 rounded-2xl w-full max-w-sm text-gray-900",
                onClick: e => e.stopPropagation()
            }, 
                e("h3", { className: "font-bold text-xl text-orange-600 mb-4" }, "重置本車狀態"),
                e("p", { className: "text-sm text-gray-600 mb-6" }, "此操作將清除所有團員的報到記錄，但名單會保留。確定繼續嗎？"),
                e("button", {
                    onClick: () => {
                        updateBusData(viewingBusId, { boardedIds: [] });
                        setModal(null);
                        showModalMessage("重置完成", "本車次所有團員的報到狀態已清除。");
                    },
                    className: "w-full bg-orange-500 text-white py-3 rounded-lg font-bold mb-2 hover:bg-orange-600 active:scale-[0.98] transition-transform"
                }, "確認重置 (全員未上車)"),
                e("button", {
                    onClick: () => setModal(null),
                    className: "w-full bg-gray-200 py-3 rounded-lg font-bold hover:bg-gray-300"
                }, "取消")
            ))
        );
    };

    // 4. Member Scan View
    const MemberScanView = e("div", {
        className: "min-h-screen bg-blue-600 flex flex-col items-center justify-center p-6 text-white"
    }, 
        e("div", { className: "bg-white text-gray-900 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center" }, 
            e("h2", { className: "text-3xl font-extrabold mb-2 text-blue-800" }, "團員快速報到"),
            e("p", { className: "text-sm text-gray-500 mb-6" }, "請輸入手機號碼末 3 碼完成報到"),
            e("input", {
                value: inputs.memberPhone,
                onChange: e => setInputs({ ...inputs, memberPhone: e.target.value.replace(/\D/g,'') }), // Only digits
                className: "w-full border-4 border-blue-200 bg-blue-50 text-center text-4xl font-bold p-4 rounded-xl mb-6 outline-none tracking-widest",
                maxLength: 3,
                type: "tel",
                pattern: "[0-9]{3}",
                placeholder: "---"
            }),
            e("button", {
                onClick: handleMemberVerify,
                className: "w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-xl shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-transform"
            }, "確認報到"),
            e("button", {
                onClick: () => { setInputs({ ...inputs, memberPhone: '' }); setView('landing'); },
                className: "mt-4 text-gray-400 text-sm hover:text-gray-600"
            }, "返回首頁")
        )
    );

    // 5. Admin Panel View
    const AdminPanelView = e("div", {
        className: "min-h-screen bg-gray-100 p-4 text-gray-900"
    }, 
        e("div", { className: "bg-white p-6 rounded-2xl shadow-xl mb-6" }, 
            e("h2", { className: "text-3xl font-bold mb-6 text-gray-800 border-b pb-2" }, "系統設定與管理"),
            
            // Cloud Config
            e("div", { className: "bg-gray-800 text-white p-4 rounded-xl mb-6 shadow-inner" }, 
                e("h3", { className: "font-bold text-xl mb-3 border-b border-gray-700 pb-1 flex items-center gap-2" }, e(Icon, { i: "☁️" }), " 雲端資料庫設定"),
                !isCloud ? e(Fragment, null, 
                    e("p", { className: "text-sm text-gray-400 mb-2" }, "貼上您的 Firebase Config JSON 啟用雲端功能："),
                    e("textarea", {
                        value: inputs.firebase,
                        onChange: e => setInputs({ ...inputs, firebase: e.target.value }),
                        className: "w-full bg-black text-green-400 text-xs p-2 rounded-lg h-24 mb-3 font-mono border-none resize-none",
                        placeholder: "Firebase Config JSON"
                    }),
                    e("button", {
                        onClick: saveFirebaseConfig,
                        className: "bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold text-white hover:bg-blue-700 active:scale-[0.98] transition-transform"
                    }, "啟用雲端連線")
                ) : e("div", { className: "text-green-400 font-bold text-lg p-2 bg-gray-700 rounded-lg" }, e(Icon, { i: "✅" }), " 已成功連線至雲端資料庫")
            ),
            
            // Magic Link Generator
            isCloud && e("div", { className: "bg-indigo-50 border-2 border-indigo-200 p-4 rounded-xl mb-6 shadow-md" }, 
                e("h3", { className: "font-bold text-xl text-indigo-700 mb-3 border-b border-indigo-300 pb-1 flex items-center gap-2" }, e(Icon, { i: "🔗" }), " 分享魔術連結"),
                e("p", { className: "text-sm text-indigo-600 mb-4" }, "透過此連結，其他使用者打開網站後會自動套用雲端設定。"),
                e("button", {
                    onClick: generateMagicLink,
                    className: "w-full bg-indigo-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-indigo-700 active:scale-[0.98] transition-transform"
                }, e(Icon, { i: "✨", className: "mr-0" }), " 複製「自動設定」連結")
            ),

            // Leader Management (Placeholder for future development)
            e("div", { className: "bg-gray-50 border-2 border-gray-200 p-4 rounded-xl mb-6 shadow-inner" }, 
                e("h3", { className: "font-bold text-xl text-gray-700 mb-3 border-b border-gray-300 pb-1 flex items-center gap-2" }, e(Icon, { i: "👥" }), " 領隊帳號管理"),
                leaders.map(l => e("div", { key: l.id, className: "flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0 text-sm" }, 
                    e("div", { className: "font-semibold" }, l.name, e("span", { className: "text-xs text-gray-500 ml-2" }, `(${l.busId})`)),
                    e("span", { className: "text-gray-600" }, l.username)
                )),
                e("p", { className: "text-xs text-gray-400 mt-3" }, "（目前僅支援手動修改 leaders 陣列，雲端模式下請直接編輯 Firestore config/main 文件）")
            ),
            
            e("button", {
                onClick: () => { setIdentity(null); setView('landing'); },
                className: "w-full border border-red-300 text-red-500 p-3 rounded-xl font-bold mt-4 hover:bg-red-50"
            }, "登出管理員")
        )
    );

    // --- Main Render Switch ---
    switch (view) {
        case 'landing': return LandingView;
        case 'admin_login': return AdminLoginView;
        case 'dashboard': return e(DashboardView);
        case 'member_scan': return MemberScanView;
        case 'admin_panel': return AdminPanelView;
        default: return e("div", { className: "text-center p-8 text-white" }, "Loading...");
    }
}

// Render the application
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(App, null));