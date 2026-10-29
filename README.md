<div align="center">

# POS Awesome Desktop

![PAN](logo.png)

</div>

غلاف Electron لنقطة بيع **POS Awesome** (Frappe / ERPNext)، مع شاشة ربط سيرفر مقفلة بكلمة مرور،
ودعم شاشة عميل إضافية (ثانية) عبر تطبيق **PAN Customer Display**.

تطوير: مؤسسة بان الدولية للاتصالات وتقنية المعلومات — [pan.sa](https://pan.sa)

---

## المزايا

- شاشة ربط بالسيرفر (عنوان ERPNext) تُحفظ محليًا، وتُقفل بكلمة مرور بعد أول استخدام.
- مفتاح تفعيل/تعطيل **شاشة العميل** خاص بكل جهاز، منفصل تمامًا عن إعداد السيرفر نفسه.
- عند توفر تطبيق [PAN Customer Display](https://github.com/mtas101/pan_customer_display) على
  السيرفر: تُفتح شاشة العميل كنافذة داخلية حقيقية على الشاشة الثانوية (مع إخفاء شريط القوائم
  منها فقط)، ويتم التواصل بينها وبين نقطة البيع تلقائيًا.
- صفحة عمل بلا اتصال (Offline) عند تعذّر الوصول للسيرفر، مع إعادة محاولة الاتصال.

## المحتويات

هذا المستودع يحتوي **فقط** على غلاف Electron (`electron/main.js`، `electron/preload.js`،
`electron/renderer/`) الذي كُتب خصيصًا لهذا المشروع. هو لا يتضمن كود واجهة **POS Awesome** نفسها
(المشروع الأصلي: [defendicon/POS-Awesome-V15](https://github.com/defendicon/POS-Awesome-V15))،
لأنه يُحمَّل من سيرفر ERPNext الخاص بك عبر الإنترنت، ولا يُحزَّم محليًا.

## التشغيل من المصدر (للتطوير)

```bash
git clone https://github.com/mtas101/pos-awesome-desktop
cd pos-awesome-desktop
npm install
npx electron .
```

عند أول تشغيل ستظهر شاشة الربط لإدخال عنوان سيرفر ERPNext (مثال: `https://pos.example.com`)
وإنشاء كلمة مرور لحماية هذه الشاشة لاحقًا.

## بناء نسخة تثبيت (exe) محليًا

```bash
npm install
npm run build
```

ينتج ملف تثبيت NSIS داخل `dist/` (مثال: `POS Awesome Desktop Setup 1.0.0.exe`)، باستخدام نفس
إصدار Electron المثبّت في `package.json`.

## نسخة جاهزة للتنصيب

للحصول على نسخة بنيت مسبقًا (Windows، بلا الحاجة لـ Node.js) راجع صفحة
[Releases](https://github.com/mtas101/pos-awesome-desktop/releases) في هذا المستودع — حمّل ملف
الـ zip، فك الضغط، وشغّل `electron.exe` (أو الملف التنفيذي الظاهر داخل المجلد). يمكن نسخ هذا
المجلد مباشرة لأي جهاز كاشير آخر يعمل بويندوز دون أي تثبيت إضافي.

## الترخيص

MIT — راجع `license.txt`. لا يشمل الترخيص كود POS Awesome نفسه (مشروع منفصل بترخيصه الخاص).
