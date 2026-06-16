const admin = require('firebase-admin');

// Use application default credentials from environment or ADC
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  (process.env.APPDATA ? `${process.env.APPDATA}/gcloud/application_default_credentials.json` : null);

admin.initializeApp({
  projectId: 'canil-gcm',
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

const shiftsPermissions = {
  administrador: { view: true, create: true, edit: true, archive: true, export: true, approve: true, audit: true },
  gestor: { view: true, create: true, edit: true, archive: true, export: true },
  instrutor_k9: { view: true, create: true, edit: true },
  operador_k9: { view: true, create: true, edit: true }
};

async function update() {
  const profilesSnap = await db.collection('access_profiles').get();
  
  for (const profileDoc of profilesSnap.docs) {
    const profileId = profileDoc.id;
    const currentData = profileDoc.data();
    const currentPerms = currentData.permissions || {};
    
    if (!currentPerms.shifts) {
      const newPerms = { ...currentPerms, shifts: shiftsPermissions[profileId] || { view: true } };
      await profileDoc.ref.update({ permissions: newPerms });
      console.log(`Updated ${profileId}`);
    } else {
      console.log(`Skipping ${profileId} - already has shifts`);
    }
  }
  console.log('Done!');
}

update().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
