// Rollback-only modules cannot be loaded by a Neon native bundle.
module.exports=new Proxy({}, {get(){throw new Error('The Firestore backend is unavailable in this Neon build.');}});
