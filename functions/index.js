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