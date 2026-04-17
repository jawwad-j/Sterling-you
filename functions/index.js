// v2 - productPreview added
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
admin.initializeApp();

exports.superAdminResetStaffPassword = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
    }
    const callerDoc = await admin.firestore()
        .collection("admin_users")
        .doc(context.auth.uid)
        .get();
    if (!callerDoc.exists || callerDoc.data().role !== "super_admin") {
        throw new functions.https.HttpsError("permission-denied", "Only Super Admins can reset passwords.");
    }
    const { targetStaffUid, newPassword } = data;
    if (!targetStaffUid || !newPassword || newPassword.length < 6) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid UID or password.");
    }
    await admin.auth().updateUser(targetStaffUid, { password: newPassword });
    return { message: "Password updated successfully. No email was sent." };
});

exports.productPreview = functions.https.onRequest(async (req, res) => {
    const productId = req.query.id;
    if (!productId) return res.redirect('https://sterlingyou.com/product');
    try {
        const doc = await admin.firestore().collection('products').doc(productId).get();
        if (!doc.exists) return res.redirect('https://sterlingyou.com/product');
        const p = doc.data();
        const image = p.image || 'https://sterlingyou.com/og-cover.jpg';
        const name  = p.name  || 'Sterling You Product';
        const desc  = p.shortDesc || p.longDesc || 'Shop premium fashion at sterlingyou.com';
        const price = p.price || '';
        res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta property="og:type" content="product">
    <meta property="og:site_name" content="Sterling You">
    <meta property="og:title" content="${name} | Sterling You">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:width" content="800">
    <meta property="og:image:height" content="1067">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:alt" content="${name}">
    <meta property="product:price:amount" content="${price}">
    <meta property="product:price:currency" content="BDT">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${name} | Sterling You">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${image}">
</head>
<body>
<p>Redirecting...</p>
<script>window.location.replace('https://sterlingyou.com/product?id=${productId}');</script>
</body>
</html>`);
    } catch(e) {
        return res.redirect('https://sterlingyou.com/product?id=' + productId);
    }
});