const path = require("path");
const { app, BrowserWindow, ipcMain, net, shell, Menu, screen } = require("electron");

const DEFAULT_PATH = "/app/posapp";

let store;
const storeReady = (async () => {
	const { default: Store } = await import("electron-store");
	store = new Store({
		name: "posawesome-desktop",
		defaults: {
			serverUrl: "",
			// تفعيل شاشة العميل الإضافية (يُضبط من شاشة الربط)
			customerDisplay: true,
		},
	});
})();

async function ensureStoreReady() {
	await storeReady;
	if (!store) {
		throw new Error("Failed to initialize settings store");
	}
}

let mainWindow;
// نوافذ شاشة العميل المفتوحة حالياً (لإغلاقها عند تعطيل الميزة)
const customerWindows = new Set();

function customerDisplayEnabled() {
	return !store || store.get("customerDisplay", true) !== false;
}

// ---------- قفل شاشة الربط بكلمة مرور ----------
// كلمة المرور لا تُخزَّن نصاً؛ يُخزَّن ملح + بصمة scrypt فقط.
const crypto = require("crypto");
let setupUnlocked = false;

function hasSetupPassword() {
	const p = store && store.get("setupPassword");
	return !!(p && p.salt && p.hash);
}

function hashPassword(password, salt) {
	return crypto.scryptSync(String(password), salt, 32).toString("hex");
}

function saveSetupPassword(password) {
	const value = String(password || "");
	if (value.length < 4) {
		throw new Error("كلمة المرور يجب ألا تقل عن 4 أحرف");
	}
	const salt = crypto.randomBytes(16).toString("hex");
	store.set("setupPassword", { salt, hash: hashPassword(value, salt) });
}

function checkSetupPassword(password) {
	const p = store.get("setupPassword");
	if (!p || !p.salt || !p.hash) {
		return false;
	}
	const a = Buffer.from(hashPassword(password, p.salt), "hex");
	const b = Buffer.from(p.hash, "hex");
	return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireUnlocked() {
	if (!setupUnlocked) {
		throw new Error("شاشة الإعدادات مقفلة - أدخل كلمة المرور أولاً");
	}
}

function ensureUrl(rawUrl) {
	if (!rawUrl || typeof rawUrl !== "string") {
		return "";
	}

	const trimmed = rawUrl.trim();
	if (!trimmed) {
		return "";
	}

	const tryParse = (value) => {
		try {
			const parsed = new URL(value);
			return parsed;
		} catch {
			return null;
		}
	};

	let parsed = tryParse(trimmed);
	if (!parsed) {
		parsed = tryParse(`https://${trimmed}`);
	}

	if (!parsed) {
		return "";
	}

	parsed.hash = "";
	if (!parsed.protocol || parsed.protocol === ":") {
		parsed.protocol = "https:";
	}

	if (!parsed.hostname) {
		return "";
	}

	const trimmedPath = parsed.pathname?.replace(/\/+$/, "") || "";
	if (!trimmedPath || trimmedPath === "/") {
		parsed.pathname = DEFAULT_PATH;
	} else if (trimmedPath === "/app/posawesome" || trimmedPath.startsWith("/app/posawesome/")) {
		parsed.pathname = trimmedPath.replace("/app/posawesome", DEFAULT_PATH);
	}

	return parsed.toString().replace(/\/$/, "");
}

function getStoredUrl() {
	if (!store) {
		return "";
	}
	const raw = store.get("serverUrl", "");
	const normalized = ensureUrl(raw);
	if (!normalized) {
		return "";
	}
	return normalized;
}

function createWindow() {
	mainWindow = new BrowserWindow({
		height: 900,
		width: 1400,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
			spellcheck: false,
		},
		backgroundColor: "#101828",
		show: false,
	});

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		// شاشة العميل الثانية (pan_customer_display) يجب أن تُفتح كنافذة داخلية
		// حقيقية حتى يعمل التواصل بينها وبين صفحة POS عبر postMessage/opener.
		if (url.includes("/assets/pan_customer_display/display/")) {
			// الميزة معطّلة من شاشة الربط: لا تُفتح شاشة العميل إطلاقاً
			if (!customerDisplayEnabled()) {
				return { action: "deny" };
			}
			return {
				action: "allow",
				overrideBrowserWindowOptions: {
					backgroundColor: "#0d1117",
					show: false,
					webPreferences: {
						contextIsolation: true,
						nodeIntegration: false,
						sandbox: false,
					},
				},
			};
		}
		shell.openExternal(url);
		return { action: "deny" };
	});

	// بعد إنشاء نافذة شاشة العميل فعلياً: نقلها لشاشة ثانوية وملء الشاشة من جهة
	// Electron نفسها (أكثر ثباتاً من الاعتماد على Screen Detection API داخل الصفحة
	// التي قد لا تُمنح صلاحيتها تلقائياً داخل Electron)، وجلبها للمقدمة والتركيز عليها.
	mainWindow.webContents.on("did-create-window", (childWindow, details) => {
		if (!details.url || !details.url.includes("/assets/pan_customer_display/display/")) {
			return;
		}
		// إخفاء شريط القوائم (POS Awesome / Edit / View) من نافذة العميل فقط؛ نافذة الكاشير تبقى كما هي.
		childWindow.setMenu(null);
		childWindow.setMenuBarVisibility(false);
		childWindow.setAutoHideMenuBar(true);
		customerWindows.add(childWindow);
		childWindow.on("closed", () => customerWindows.delete(childWindow));
		const displays = screen.getAllDisplays();
		const primary = screen.getPrimaryDisplay();
		const secondary = displays.find((d) => d.id !== primary.id) || null;

		childWindow.once("ready-to-show", () => {
			if (secondary) {
				childWindow.setBounds(secondary.bounds);
				childWindow.setFullScreen(true);
			}
			childWindow.show();
			childWindow.focus();
			childWindow.moveTop();
		});
	});

	mainWindow.webContents.on("did-fail-load", (_event, errorCode) => {
		if (errorCode === -3) {
			return;
		}
		loadOffline();
	});

	mainWindow.once("ready-to-show", () => {
		mainWindow.show();
	});

	const target = getStoredUrl();
	if (target) {
		loadServer(target);
	} else {
		loadSetup();
	}

	buildAppMenu();
}

function loadSetup() {
	setupUnlocked = false; // تُقفل في كل مرة تُفتح فيها شاشة الربط
	const setupPath = path.join(__dirname, "renderer", "setup.html");
	mainWindow.loadFile(setupPath);
}

function loadOffline() {
	const offlinePath = path.join(__dirname, "renderer", "offline.html");
	mainWindow.loadFile(offlinePath);
}

function loadServer(serverUrl) {
	if (!store) {
		return;
	}
	const normalized = ensureUrl(serverUrl);
	if (!normalized) {
		loadSetup();
		return;
	}

	store.set("serverUrl", normalized);
	setupUnlocked = false;
	mainWindow.loadURL(normalized);
}

function buildAppMenu() {
	const template = [
		{
			label: "POS Awesome",
			submenu: [
				{
					label: "Change server",
					accelerator: "CmdOrCtrl+Shift+C",
					click: () => {
						if (mainWindow) {
							loadSetup();
							mainWindow.focus();
						}
					},
				},
				{ type: "separator" },
				{ role: "reload" },
				{ role: "toggleDevTools" },
				{ type: "separator" },
				process.platform === "darwin" ? { role: "close" } : { role: "quit" },
			].filter(Boolean),
		},
		{ role: "editMenu" },
		{ role: "viewMenu" },
	];

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

async function probeServer() {
	await ensureStoreReady();
	const url = getStoredUrl();
	if (!url) {
		return { reachable: false, message: "No server URL configured" };
	}

	return new Promise((resolve) => {
		const request = net.request({ method: "HEAD", url });
		request.on("response", (response) => {
			resolve({ reachable: true, status: response.statusCode, url });
		});
		request.on("error", (error) => {
			resolve({ reachable: false, message: error.message });
		});
		request.end();
	});
}

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.whenReady().then(async () => {
	await ensureStoreReady();
	app.setAppUserModelId("com.posawesome.desktop");
	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

ipcMain.handle("get-server-url", async () => {
	await ensureStoreReady();
	return store.get("serverUrl", "");
});

ipcMain.handle("normalize-server-url", (_event, value) => ensureUrl(value));

// تفعيل/تعطيل شاشة العميل الإضافية (من شاشة الربط) — تقرؤه صفحة POS لإظهار زر الشاشة أو إخفائه
ipcMain.handle("get-customer-display", async () => {
	await ensureStoreReady();
	return customerDisplayEnabled();
});

// حالة القفل وكلمة المرور
ipcMain.handle("setup-lock-state", async () => {
	await ensureStoreReady();
	return { hasPassword: hasSetupPassword(), unlocked: setupUnlocked };
});

ipcMain.handle("setup-create-password", async (_event, value) => {
	await ensureStoreReady();
	if (hasSetupPassword()) {
		throw new Error("كلمة المرور معيّنة مسبقاً");
	}
	saveSetupPassword(value);
	setupUnlocked = true;
	return { unlocked: true };
});

ipcMain.handle("setup-unlock", async (_event, value) => {
	await ensureStoreReady();
	if (!hasSetupPassword()) {
		throw new Error("لم تُعيَّن كلمة مرور بعد");
	}
	if (!checkSetupPassword(value)) {
		await new Promise((r) => setTimeout(r, 800)); // إبطاء محاولات التخمين
		throw new Error("كلمة المرور غير صحيحة");
	}
	setupUnlocked = true;
	return { unlocked: true };
});

ipcMain.handle("setup-change-password", async (_event, value) => {
	await ensureStoreReady();
	requireUnlocked();
	saveSetupPassword(value);
	return { changed: true };
});

ipcMain.handle("set-customer-display", async (_event, value) => {
	await ensureStoreReady();
	requireUnlocked();
	const enabled = value !== false;
	store.set("customerDisplay", enabled);
	if (!enabled) {
		customerWindows.forEach((w) => {
			if (!w.isDestroyed()) {
				w.close();
			}
		});
	}
	return enabled;
});

ipcMain.handle("set-server-url", async (_event, value) => {
	await ensureStoreReady();
	requireUnlocked();
	const normalized = ensureUrl(value);
	if (!normalized) {
		throw new Error("Please provide a valid server URL (e.g. https://example.com)");
	}
	loadServer(normalized);
	return normalized;
});

ipcMain.handle("retry-load", async () => {
	await ensureStoreReady();
	const url = getStoredUrl();
	if (!url) {
		loadSetup();
		return { launched: false };
	}
	loadServer(url);
	return { launched: true, url };
});

ipcMain.handle("open-settings", () => {
	loadSetup();
	return { opened: true };
});

ipcMain.handle("probe-server", async () => probeServer());

ipcMain.handle("reset-server", async () => {
	await ensureStoreReady();
	requireUnlocked();
	store.delete("serverUrl");
	loadSetup();
});
