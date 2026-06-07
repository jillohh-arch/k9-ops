import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { auth } from "@/lib/firebase/client";

const RA_EMAIL_DOMAIN = "gcm.com.br";

export function normalizeRa(value: string) {
  return value.replace(/\D/g, "");
}

function raToAuthEmail(ra: string) {
  return `${normalizeRa(ra)}@${RA_EMAIL_DOMAIN}`;
}

export async function signInWithRa(
  ra: string,
  password: string,
  keepConnected: boolean,
) {
  const email = raToAuthEmail(ra);
  const persistence = keepConnected
    ? browserLocalPersistence
    : browserSessionPersistence;

  await setPersistence(auth, persistence);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function sendPasswordResetForRa(ra: string) {
  const email = raToAuthEmail(ra);
  return sendPasswordResetEmail(auth, email);
}

export function getAuthErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "RA ou senha invalidos.";
    case "auth/invalid-email":
      return "Informe um RA valido.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    case "auth/network-request-failed":
      return "Falha de conexao. Verifique a internet e tente novamente.";
    default:
      return "Nao foi possivel concluir a operacao agora. Tente novamente.";
  }
}

export function sanitizeNextPath(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/dashboard";
  }

  return path;
}
