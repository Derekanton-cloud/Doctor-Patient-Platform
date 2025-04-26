const bcrypt = require('bcrypt');

async function hashPassword(password) {
    const normalizedPassword = String(password).trim();
    const saltRounds = 10;
    const hash = await bcrypt.hash(normalizedPassword, saltRounds);

    console.log("🔐 Hashing password:", {
        normalizedPassword,
        hash,
        hashPrefix: hash.substring(0, 10),
        hashLength: hash.length
    });

    return hash;
}

async function verifyPassword(plainPassword, hashedPassword) {
    const normalizedPassword = String(plainPassword).trim();
    const isValid = await bcrypt.compare(normalizedPassword, hashedPassword);

    console.log("🔐 Verifying password:", {
        normalizedPassword,
        hashedPassword,
        isValid
    });

    return isValid;
}

module.exports = { hashPassword, verifyPassword };