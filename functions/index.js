const functions = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
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

exports.productPreview = onRequest(async (req, res) => {
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

exports.ga4Stats = onRequest(
    { secrets: ["GA4_SERVICE_ACCOUNT"] },
    async (req, res) => {
        res.set('Access-Control-Allow-Origin', 'https://sterlingyou.com');
        res.set('Access-Control-Allow-Methods', 'GET');

        try {
            const serviceAccount = JSON.parse(process.env.GA4_SERVICE_ACCOUNT);
            const analyticsClient = new BetaAnalyticsDataClient({
                credentials: {
                    client_email: serviceAccount.client_email,
                    private_key: serviceAccount.private_key
                }
            });

            const { startDate, endDate } = req.query;

            const [response] = await analyticsClient.runReport({
                property: `properties/530239079`,
                dateRanges: [{ startDate: startDate || '30daysAgo', endDate: endDate || 'today' }],
                metrics: [
                    { name: 'screenPageViews' },
                    { name: 'totalUsers' },
                    { name: 'newUsers' },
                    { name: 'sessions' }
                ],
                dimensions: [{ name: 'date' }],
                orderBys: [{ dimension: { dimensionName: 'date' } }]
            });

            const data = response.rows?.map(row => ({
                date: row.dimensionValues[0].value,
                pageViews: parseInt(row.metricValues[0].value),
                totalUsers: parseInt(row.metricValues[1].value),
                newUsers: parseInt(row.metricValues[2].value),
                sessions: parseInt(row.metricValues[3].value)
            })) || [];

            res.json({ success: true, data });

        } catch(e) {
            console.error('GA4 error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    }
);