/**
 * R1 / R4 Web Authority Parity Tests for AuthProvider.
 *
 * NOTE: Web UI authority enforcement mirrors Firestore `users/{ra}` exclusively
 * for client UX and NEVER replaces server-side authorization (Firestore Rules
 * and Cloud Functions remain authoritative).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";

const {
  mockAuth,
  mockGetDoc,
  mockGetDocs,
  mockSignOut,
  idTokenListeners,
  unsubscribeSpy,
} = vi.hoisted(() => ({
  mockAuth: { currentUser: null as User | null },
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockSignOut: vi.fn(async () => undefined),
  idTokenListeners: [] as Array<(user: User | null) => void>,
  unsubscribeSpy: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({
  auth: mockAuth,
  db: {},
}));

vi.mock("firebase/auth", () => ({
  onIdTokenChanged: vi.fn(
    (_auth: unknown, callback: (user: User | null) => void) => {
      idTokenListeners.push(callback);
      return unsubscribeSpy;
    },
  ),
  signOut: mockSignOut,
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ _collection: name })),
  doc: vi.fn((_db: unknown, coll: string, id: string) => ({
    _path: `${coll}/${id}`,
    id,
  })),
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  limit: vi.fn((n: number) => ({ _limit: n })),
  query: vi.fn((source: unknown, ...constraints: unknown[]) => ({
    source,
    constraints,
  })),
  where: vi.fn((field: string, op: string, value: unknown) => ({
    field,
    op,
    value,
  })),
}));

import {
  AuthProvider,
  isUserMirrorCurrentlyActive,
  resolveAuthProfileRoles,
  resolveIsK9Instructor,
  useAuth,
  type AuthProfile,
  type UserMirror,
} from "../auth-provider";

function AuthProbe() {
  const { isAuthenticated, profile, refreshClaims, status, user } = useAuth();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="instructor">{String(Boolean(profile?.isK9Instructor))}</span>
      <span data-testid="roles">{JSON.stringify(profile?.roles ?? null)}</span>
      <span data-testid="mirror">{profile?.userMirror ? "present" : "null"}</span>
      <span data-testid="ra">{profile?.ra ?? "null"}</span>
      <span data-testid="user-uid">{user?.uid ?? "null"}</span>
      <pre data-testid="profile-json">{JSON.stringify(profile)}</pre>
      <button
        type="button"
        data-testid="refresh-claims"
        onClick={() => {
          void refreshClaims();
        }}
      >
        Refresh
      </button>
    </div>
  );
}

function readProfile(): AuthProfile | null {
  const raw = screen.getByTestId("profile-json").textContent ?? "null";
  return JSON.parse(raw) as AuthProfile | null;
}

function makeMockUser(options?: {
  claims?: Record<string, unknown>;
  displayName?: string | null;
  email?: string | null;
  getIdTokenError?: Error;
  getIdTokenResultError?: Error;
  photoURL?: string | null;
  uid?: string;
}): User {
  const claims = options?.claims ?? {};
  return {
    uid: options?.uid ?? "uid-100",
    email: options?.email === undefined ? "123456@gcm.com.br" : options.email,
    displayName: options?.displayName ?? "Condutor Teste",
    photoURL: options?.photoURL ?? null,
    getIdToken: vi.fn(async () => {
      if (options?.getIdTokenError) {
        throw options.getIdTokenError;
      }
      return "token-123";
    }),
    getIdTokenResult: vi.fn(async () => {
      if (options?.getIdTokenResultError) {
        throw options.getIdTokenResultError;
      }
      return { claims };
    }),
  } as unknown as User;
}

function docSnap(data: UserMirror | null) {
  return {
    exists: () => data !== null,
    data: () => data,
  };
}

function docsSnap(entries: Array<{ id: string; data: UserMirror }>) {
  return {
    docs: entries.map((entry) => ({
      id: entry.id,
      data: () => entry.data,
    })),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function emitAuthState(user: User | null) {
  const listener = idTokenListeners[idTokenListeners.length - 1];
  if (!listener) {
    throw new Error("No onIdTokenChanged listener registered");
  }
  listener(user);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockAuth.currentUser = null;
  idTokenListeners.length = 0;
});

describe("R1 Pure Authority Helpers (auth-provider)", () => {
  it("isUserMirrorCurrentlyActive enforces R1 active lifecycle gates", () => {
    expect(isUserMirrorCurrentlyActive(null)).toBe(false);
    expect(isUserMirrorCurrentlyActive(undefined)).toBe(false);
    expect(isUserMirrorCurrentlyActive({})).toBe(true);
    expect(isUserMirrorCurrentlyActive({ active: true, status: "Ativo" })).toBe(true);
    expect(isUserMirrorCurrentlyActive({ active: false })).toBe(false);
    expect(isUserMirrorCurrentlyActive({ deleted_at: "2026-01-01T00:00:00Z" })).toBe(false);
    expect(isUserMirrorCurrentlyActive({ deleted_at: { seconds: 1700000000 } })).toBe(false);
    expect(isUserMirrorCurrentlyActive({ archived_at: "2026-01-01T00:00:00Z" })).toBe(false);
    expect(isUserMirrorCurrentlyActive({ archived_at: { seconds: 1700000000 } })).toBe(false);
    expect(isUserMirrorCurrentlyActive({ status: "Inativo" })).toBe(false);
    expect(isUserMirrorCurrentlyActive({ status: "inactive" })).toBe(false);
    expect(isUserMirrorCurrentlyActive({ status: " Inativo " })).toBe(false);
  });

  it("resolveIsK9Instructor gives explicit false precedence over all legacy flags", () => {
    expect(
      resolveIsK9Instructor({
        active: true,
        is_k9_instructor: false,
        training_instructor: true,
        instrutor_k9: true,
        instrutor: true,
        adestrador: true,
        training_role: "instrutor_k9",
        roles: ["instrutor_k9", "instrutor", "adestrador"],
      }),
    ).toBe(false);
  });

  it("resolveIsK9Instructor fails closed on non-boolean non-nullish values", () => {
    expect(
      resolveIsK9Instructor({
        is_k9_instructor: "true" as unknown as boolean,
        training_instructor: true,
      }),
    ).toBe(false);
    expect(
      resolveIsK9Instructor({
        is_k9_instructor: 1 as unknown as boolean,
        instrutor_k9: true,
      }),
    ).toBe(false);
    expect(
      resolveIsK9Instructor({
        is_k9_instructor: 0 as unknown as boolean,
        training_role: "instrutor_k9",
      }),
    ).toBe(false);
  });

  it("resolveIsK9Instructor handles non-string entries inside userMirror.roles safely", () => {
    expect(
      resolveIsK9Instructor({
        roles: [null, 123, {}, " Instrutor_K9 "] as unknown as string[],
      }),
    ).toBe(true);
    expect(
      resolveIsK9Instructor({
        roles: [null, 123, "condutor"] as unknown as string[],
      }),
    ).toBe(false);
  });

  it("resolveAuthProfileRoles strips ratified legacy instructor tokens when revoked", () => {
    const roles = resolveAuthProfileRoles(
      {
        is_k9_instructor: false,
        role: "condutor",
        training_role: "instrutor_k9",
        roles: ["instrutor_k9", "instrutor", "adestrador", "adestrador_k9", "k9_instructor", "condutor"],
      },
      false,
    );
    expect(roles).toEqual(["condutor"]);
  });
});

describe("AuthProvider — R1 & R4 Shared Authority Contract (IR-01..IR-08)", () => {
  it("IR-08a: starts in loading state with profile === null before auth emission", () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("instructor")).toHaveTextContent("false");
    expect(readProfile()).toBeNull();
  });

  it("unauthenticated emission sets status='unauthenticated' and profile=null", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(null);
    });

    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(readProfile()).toBeNull();
    expect(screen.getByTestId("user-uid")).toHaveTextContent("null");
  });

  it("IR-01: explicit is_k9_instructor: false overrides all legacy flags and JWT claims", async () => {
    const user = makeMockUser({
      claims: {
        ra: "1001",
        instrutor_k9: true,
        training_instructor: true,
        role: "instrutor_k9",
        training_role: "instrutor_k9",
        roles: ["instrutor_k9"],
      },
    });

    mockGetDoc.mockResolvedValueOnce(
      docSnap({
        active: true,
        is_k9_instructor: false,
        training_instructor: true,
        instrutor_k9: true,
        instrutor: true,
        adestrador: true,
        training_role: "instrutor_k9",
        roles: ["instrutor_k9", "condutor"],
      }),
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(user);
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });

    expect(readProfile()?.isK9Instructor).toBe(false);
    expect(readProfile()?.roles).toEqual(["condutor"]);
  });

  it("IR-02: stale pre-revocation JWT cannot rescue revoked instructor and refreshClaims drops elevation", async () => {
    let mirrorRevoked = false;
    const user = makeMockUser({
      claims: {
        ra: "1002",
        instrutor_k9: true,
      },
    });
    mockAuth.currentUser = user;

    mockGetDoc.mockImplementation(async () =>
      docSnap(
        mirrorRevoked
          ? {
              active: true,
              is_k9_instructor: false,
              roles: ["instrutor", "adestrador", "instrutor_k9"],
              training_role: "instrutor_k9",
            }
          : {
              active: true,
              is_k9_instructor: true,
              roles: ["instrutor_k9"],
              training_role: "instrutor_k9",
            },
      ),
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(user);
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(readProfile()?.isK9Instructor).toBe(true);

    // Revoke in Firestore while JWT still holds stale { instrutor_k9: true }
    mirrorRevoked = true;
    const deferredToken = createDeferred<string>();
    (user.getIdToken as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      deferredToken.promise,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("refresh-claims"));
    });

    // During re-hydration loading state, stale profile must be cleared to null
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(readProfile()).toBeNull();
    expect(screen.getByTestId("instructor")).toHaveTextContent("false");

    await act(async () => {
      deferredToken.resolve("fresh-token-with-stale-claim");
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(readProfile()?.isK9Instructor).toBe(false);
    expect(readProfile()?.roles).toEqual([]);
  });

  it("IR-03: active canonical instructor with base access_profile_id preserves both", async () => {
    const user = makeMockUser({ claims: { ra: "1003" } });
    mockGetDoc.mockResolvedValueOnce(
      docSnap({
        active: true,
        is_k9_instructor: true,
        access_profile_id: "operador_k9",
      }),
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(user);
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });

    expect(readProfile()?.isK9Instructor).toBe(true);
    expect(readProfile()?.userMirror?.access_profile_id).toBe("operador_k9");
  });

  it("IR-04: active canonical instructor without access_profile_id does not fabricate profile fields", async () => {
    const user = makeMockUser({ claims: { ra: "1004" } });
    mockGetDoc.mockResolvedValueOnce(
      docSnap({
        active: true,
        is_k9_instructor: true,
      }),
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(user);
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });

    expect(readProfile()?.isK9Instructor).toBe(true);
    expect(readProfile()?.userMirror?.access_profile_id).toBeUndefined();
    expect(readProfile()?.roles).toEqual([]);
  });

  it.each<[string, UserMirror]>([
    ["undefined + training_instructor", { training_instructor: true }],
    ["undefined + instrutor_k9", { instrutor_k9: true }],
    ["undefined + instrutor", { instrutor: true }],
    ["undefined + adestrador", { adestrador: true }],
    ["undefined + trimmed training_role", { training_role: "  Instrutor_K9 " }],
    ["undefined + k9_instructor training_role", { training_role: "k9_instructor" }],
    ["undefined + roles adestrador", { roles: ["ADESTRADOR"] }],
    ["undefined + roles adestrador_k9", { roles: ["adestrador_k9"] }],
    [
      "null + training_role instrutor_k9",
      {
        is_k9_instructor: null as unknown as undefined,
        training_role: "instrutor_k9",
      },
    ],
    [
      "null + roles instrutor",
      {
        is_k9_instructor: null as unknown as undefined,
        roles: ["instrutor"],
      },
    ],
  ])(
    "IR-05 (positive): absent canonical field uses ratified userMirror legacy compat (%s)",
    async (_label, mirror) => {
      const user = makeMockUser({ claims: { ra: "1005" } });
      mockGetDoc.mockResolvedValueOnce(docSnap({ active: true, ...mirror }));

      render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );

      await act(async () => {
        emitAuthState(user);
      });

      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
      });

      expect(readProfile()?.isK9Instructor).toBe(true);
    },
  );

  it("IR-05 (negative): absent canonical field with no userMirror legacy flags NEVER falls back to JWT claims", async () => {
    const user = makeMockUser({
      claims: {
        ra: "1005-neg",
        instrutor_k9: true,
        training_instructor: true,
        role: "instrutor_k9",
        training_role: "instrutor_k9",
        roles: ["instrutor_k9"],
      },
    });
    mockGetDoc.mockResolvedValueOnce(
      docSnap({
        active: true,
        access_profile_id: "operador_k9",
      }),
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(user);
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });

    expect(readProfile()?.isK9Instructor).toBe(false);
    expect(readProfile()?.roles).toEqual([]);
  });

  it("IR-06: missing users/{ra} doc and identity fallback miss fail closed despite instructor JWT claims", async () => {
    const user = makeMockUser({
      claims: {
        ra: "1006",
        instrutor_k9: true,
        role: "instrutor_k9",
        training_role: "instrutor_k9",
      },
    });
    mockGetDoc.mockResolvedValueOnce(docSnap(null));
    mockGetDocs.mockResolvedValue(docsSnap([]));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(user);
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });

    expect(readProfile()?.userMirror).toBeNull();
    expect(readProfile()?.isK9Instructor).toBe(false);
    expect(readProfile()?.roles).toEqual([]);
  });

  it.each<[string, Partial<UserMirror>]>([
    ["active: false", { active: false }],
    ["deleted_at ISO", { deleted_at: "2026-01-01T00:00:00Z" }],
    ["deleted_at Timestamp", { deleted_at: { seconds: 1700000000 } }],
    ["archived_at ISO", { archived_at: "2026-01-01T00:00:00Z" }],
    ["archived_at Timestamp", { archived_at: { seconds: 1700000000 } }],
    ["status: Inativo", { status: "Inativo" }],
    ["status: inactive", { status: "inactive" }],
    ["status: trimmed Inativo", { status: " Inativo " }],
  ])(
    "IR-07: inactive/deleted/archived user (%s) fails closed despite is_k9_instructor: true and JWT claims",
    async (_label, lifecycleOverrides) => {
      const user = makeMockUser({
        claims: { ra: "1007", instrutor_k9: true, role: "instrutor_k9" },
      });
      mockGetDoc.mockResolvedValueOnce(
        docSnap({
          is_k9_instructor: true,
          roles: ["instrutor_k9"],
          ...lifecycleOverrides,
        }),
      );

      render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );

      await act(async () => {
        emitAuthState(user);
      });

      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
      });

      expect(readProfile()?.isK9Instructor).toBe(false);
      expect(readProfile()?.roles).toEqual([]);
    },
  );

  it("IR-08b: Firestore getDoc and getDocs read errors fail closed to userMirror=null and isK9Instructor=false", async () => {
    const user = makeMockUser({
      claims: { ra: "1008", instrutor_k9: true, role: "instrutor_k9" },
    });
    mockGetDoc.mockRejectedValueOnce(new Error("permission-denied"));
    mockGetDocs.mockRejectedValue(new Error("permission-denied"));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(user);
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });

    expect(readProfile()?.userMirror).toBeNull();
    expect(readProfile()?.isK9Instructor).toBe(false);
    expect(readProfile()?.roles).toEqual([]);
  });

  it("IR-08c: getIdTokenResult() rejection fails closed without staying stuck in loading", async () => {
    const user = makeMockUser({
      getIdTokenResultError: new Error("auth/network-request-failed"),
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(user);
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });

    expect(readProfile()?.userMirror).toBeNull();
    expect(readProfile()?.isK9Instructor).toBe(false);
    expect(readProfile()?.roles).toEqual([]);
    expect(readProfile()?.claims).toEqual({});
  });

  it("resolves userMirror via auth_uid / email identity fallback and still enforces R1 precedence", async () => {
    const user = makeMockUser({
      claims: { instrutor_k9: true },
      email: "operador@gcm.com.br",
      uid: "uid-fallback-1",
    });

    mockGetDocs.mockResolvedValueOnce(
      docsSnap([
        {
          id: "9001",
          data: {
            active: true,
            is_k9_instructor: false,
            training_instructor: true,
            training_role: "instrutor_k9",
          },
        },
      ]),
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(user);
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });

    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(readProfile()?.ra).toBe("9001");
    expect(readProfile()?.isK9Instructor).toBe(false);
    expect(readProfile()?.roles).toEqual([]);
  });

  it("async race condition: slow earlier hydration cannot clobber newer sign-out or newer user", async () => {
    const slowDeferred = createDeferred<ReturnType<typeof docSnap>>();
    const slowUser = makeMockUser({ uid: "uid-slow", claims: { ra: "2001" } });
    const fastUser = makeMockUser({ uid: "uid-fast", claims: { ra: "2002" } });

    mockGetDoc
      .mockReturnValueOnce(slowDeferred.promise)
      .mockResolvedValueOnce(
        docSnap({
          active: true,
          is_k9_instructor: false,
        }),
      );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(slowUser);
    });
    expect(screen.getByTestId("status")).toHaveTextContent("loading");

    // Newer user signs in before slowUser's getDoc resolves
    await act(async () => {
      emitAuthState(fastUser);
    });
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(screen.getByTestId("user-uid")).toHaveTextContent("uid-fast");
    expect(readProfile()?.ra).toBe("2002");
    expect(readProfile()?.isK9Instructor).toBe(false);

    // Slow first promise finally resolves with instructor=true -> MUST be ignored
    await act(async () => {
      slowDeferred.resolve(
        docSnap({
          active: true,
          is_k9_instructor: true,
        }),
      );
      await Promise.resolve();
    });

    expect(screen.getByTestId("user-uid")).toHaveTextContent("uid-fast");
    expect(readProfile()?.ra).toBe("2002");
    expect(readProfile()?.isK9Instructor).toBe(false);

    // Also test slow hydration resolving after sign-out
    const signOutRaceDeferred = createDeferred<ReturnType<typeof docSnap>>();
    mockGetDoc.mockReturnValueOnce(signOutRaceDeferred.promise);

    await act(async () => {
      emitAuthState(slowUser);
    });
    await act(async () => {
      emitAuthState(null);
    });
    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");

    await act(async () => {
      signOutRaceDeferred.resolve(docSnap({ active: true, is_k9_instructor: true }));
      await Promise.resolve();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(readProfile()).toBeNull();
  });

  it("async race condition: slow refreshClaims() resolving AFTER sign-out does NOT resurrect signed-out session", async () => {
    const userA = makeMockUser({
      uid: "refresh-signout-resolve-A",
      claims: { ra: "3001" },
    });
    mockAuth.currentUser = userA;
    mockGetDoc.mockResolvedValueOnce(
      docSnap({
        active: true,
        is_k9_instructor: true,
      }),
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(userA);
    });
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(readProfile()?.isK9Instructor).toBe(true);

    const deferredToken = createDeferred<string>();
    (userA.getIdToken as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      deferredToken.promise,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("refresh-claims"));
    });
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(readProfile()).toBeNull();

    await act(async () => {
      mockAuth.currentUser = null;
      emitAuthState(null);
    });
    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(screen.getByTestId("user-uid")).toHaveTextContent("null");
    expect(readProfile()).toBeNull();

    await act(async () => {
      deferredToken.resolve("stale-refreshed-token");
      await Promise.resolve();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("instructor")).toHaveTextContent("false");
    expect(screen.getByTestId("user-uid")).toHaveTextContent("null");
    expect(readProfile()).toBeNull();
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  it("async race condition: slow refreshClaims() rejecting AFTER sign-out does NOT resurrect signed-out session", async () => {
    const userA = makeMockUser({
      uid: "refresh-signout-reject-A",
      claims: { ra: "3002" },
    });
    mockAuth.currentUser = userA;
    mockGetDoc.mockResolvedValueOnce(
      docSnap({
        active: true,
        is_k9_instructor: true,
      }),
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(userA);
    });
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(readProfile()?.isK9Instructor).toBe(true);

    const deferredToken = createDeferred<string>();
    (userA.getIdToken as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      deferredToken.promise,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("refresh-claims"));
    });
    expect(screen.getByTestId("status")).toHaveTextContent("loading");

    await act(async () => {
      mockAuth.currentUser = null;
      emitAuthState(null);
    });
    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");

    await act(async () => {
      deferredToken.reject(new Error("auth/network-request-failed"));
      await Promise.resolve();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("instructor")).toHaveTextContent("false");
    expect(screen.getByTestId("user-uid")).toHaveTextContent("null");
    expect(readProfile()).toBeNull();
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  it("async race condition: slow refreshClaims() resolving AFTER switching to userB does NOT clobber userB back to userA", async () => {
    const userA = makeMockUser({
      uid: "refresh-switch-A",
      claims: { ra: "3003" },
    });
    const userB = makeMockUser({
      uid: "refresh-switch-B",
      claims: { ra: "3004" },
    });

    mockAuth.currentUser = userA;
    mockGetDoc
      .mockResolvedValueOnce(
        docSnap({
          active: true,
          is_k9_instructor: true,
        }),
      )
      .mockResolvedValueOnce(
        docSnap({
          active: true,
          is_k9_instructor: false,
        }),
      );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      emitAuthState(userA);
    });
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(screen.getByTestId("user-uid")).toHaveTextContent("refresh-switch-A");
    expect(readProfile()?.isK9Instructor).toBe(true);

    const deferredToken = createDeferred<string>();
    (userA.getIdToken as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      deferredToken.promise,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("refresh-claims"));
    });
    expect(screen.getByTestId("status")).toHaveTextContent("loading");

    await act(async () => {
      mockAuth.currentUser = userB;
      emitAuthState(userB);
    });
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(screen.getByTestId("user-uid")).toHaveTextContent("refresh-switch-B");
    expect(readProfile()?.ra).toBe("3004");
    expect(readProfile()?.isK9Instructor).toBe(false);

    await act(async () => {
      deferredToken.resolve("stale-userA-token");
      await Promise.resolve();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("user-uid")).toHaveTextContent("refresh-switch-B");
    expect(screen.getByTestId("instructor")).toHaveTextContent("false");
    expect(readProfile()?.ra).toBe("3004");
    expect(readProfile()?.isK9Instructor).toBe(false);
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
  });
});
