import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HumanRecord } from "@/features/effective/hooks/use-human-profile-data";

let profileDataState: {
  activeShift: HumanRecord | null;
  certifications: HumanRecord[];
  documents: HumanRecord[];
  error: string | null;
  events: HumanRecord[];
  linkedDogs: HumanRecord[];
  loading: boolean;
  movements: HumanRecord[];
  occurrences: HumanRecord[];
  promotionRequests: HumanRecord[];
  shiftLogs: HumanRecord[];
  trainings: HumanRecord[];
  user: (Record<string, unknown> & { _id: string; _source: string }) | null;
};

let authProfileState: {
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
  ra: string;
} | null;

vi.mock("next/navigation", () => ({
  useParams: () => ({ ra: "990011" }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    can: () => true,
    status: "ready",
  }),
}));

vi.mock("@/features/auth/providers/auth-provider", () => ({
  useAuth: () => ({
    profile: authProfileState,
  }),
}));

vi.mock("@/features/effective/components/human-management-panel", () => ({
  HumanManagementPanel: () => null,
}));

vi.mock("@/features/effective/components/human-record-dialogs", () => ({
  HumanMovementDialog: () => null,
  HumanRecordDialog: () => null,
}));

vi.mock("@/lib/firebase/client", () => ({ auth: {}, db: {}, functions: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => undefined),
  orderBy: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
}));

vi.mock("@/features/effective/hooks/use-human-profile-data", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/effective/hooks/use-human-profile-data")
  >("@/features/effective/hooks/use-human-profile-data");
  return {
    ...actual,
    useHumanProfileData: () => profileDataState,
  };
});

const { default: HumanProfilePage } = await import(
  "@/app/(app)/humans/[ra]/page"
);
const { default: MePage } = await import("@/app/(app)/me/page");
const { default: HumanHistoryPage } = await import(
  "@/app/(app)/humans/[ra]/history/page"
);

function mockUser(fields: Record<string, unknown> = {}) {
  return {
    _id: "990011",
    _source: "users",
    active: true,
    callsign: "BORIS",
    nomeCompleto: "Boris Silva",
    ...fields,
  };
}

beforeEach(() => {
  authProfileState = {
    displayName: "BORIS",
    email: "auth_boris@corp.internal",
    photoUrl: null,
    ra: "990011",
  };

  profileDataState = {
    activeShift: null,
    certifications: [],
    documents: [],
    error: null,
    events: [],
    linkedDogs: [],
    loading: false,
    movements: [],
    occurrences: [],
    promotionRequests: [],
    shiftLogs: [],
    trainings: [],
    user: mockUser(),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Human Readers Isolation — Personnel vs Auth/Access boundaries (Slice E)", () => {
  describe("PROFILE — Cargo / Função", () => {
    it("1. `cargo` present: displayed cargo = cargo", () => {
      profileDataState.user = mockUser({ cargo: "Condutor K9" });
      render(<HumanProfilePage />);

      const label = screen.getByText("Função");
      const container = label.closest("div")!;
      expect(within(container).getByText("Condutor K9")).toBeInTheDocument();
    });

    it("2. cargo absent, `função` present: displayed cargo = função", () => {
      profileDataState.user = mockUser({ função: "Adestrador Canil" });
      render(<HumanProfilePage />);

      const label = screen.getByText("Função");
      const container = label.closest("div")!;
      expect(within(container).getByText("Adestrador Canil")).toBeInTheDocument();
    });

    it("3. only `role` present: fails closed to '--' and role MUST NOT appear as Função", () => {
      profileDataState.user = mockUser({ role: "operador_k9" });
      render(<HumanProfilePage />);

      const label = screen.getByText("Função");
      const container = label.closest("div")!;
      expect(within(container).getByText("--")).toBeInTheDocument();
      expect(within(container).queryByText("operador_k9")).not.toBeInTheDocument();
    });

    it("4. only `accessLevel` present: fails closed to '--' and accessLevel MUST NOT appear as Função", () => {
      profileDataState.user = mockUser({ accessLevel: "gestor" });
      render(<HumanProfilePage />);

      const label = screen.getByText("Função");
      const container = label.closest("div")!;
      expect(within(container).getByText("--")).toBeInTheDocument();
      expect(within(container).queryByText("gestor")).not.toBeInTheDocument();
    });
  });

  describe("PROFILE — Institutional Email", () => {
    it("5. `institutional_email` present: displays it", () => {
      profileDataState.user = mockUser({
        institutional_email: "boris.k9@policia.sp.gov.br",
      });
      render(<HumanProfilePage />);

      const label = screen.getByText("E-mail institucional");
      const container = label.closest("div")!;
      expect(
        within(container).getByText("boris.k9@policia.sp.gov.br"),
      ).toBeInTheDocument();
    });

    it("6. only `institutionalEmail` present: displays it via canonical alias", () => {
      profileDataState.user = mockUser({
        institutionalEmail: "boris.alias@policia.sp.gov.br",
      });
      render(<HumanProfilePage />);

      const label = screen.getByText("E-mail institucional");
      const container = label.closest("div")!;
      expect(
        within(container).getByText("boris.alias@policia.sp.gov.br"),
      ).toBeInTheDocument();
    });

    it("7. only generic `email` present: fails closed to '--' and generic account email MUST NOT masquerade as Personnel email", () => {
      profileDataState.user = mockUser({
        email: "personal_account@gmail.com",
      });
      render(<HumanProfilePage />);

      const label = screen.getByText("E-mail institucional");
      const container = label.closest("div")!;
      expect(within(container).getByText("--")).toBeInTheDocument();
      expect(
        within(container).queryByText("personal_account@gmail.com"),
      ).not.toBeInTheDocument();
    });
  });

  describe("/ME — Cargo / Função", () => {
    it("8. cargo present: displayed cargo = cargo", () => {
      profileDataState.user = mockUser({ cargo: "Operador Tático K9" });
      render(<MePage />);

      const label = screen.getByText("Função");
      const container = label.closest("div")!;
      expect(within(container).getByText("Operador Tático K9")).toBeInTheDocument();
    });

    it("9. cargo absent, função present: displayed cargo = função", () => {
      profileDataState.user = mockUser({ função: "Veterinário Chefe" });
      render(<MePage />);

      const label = screen.getByText("Função");
      const container = label.closest("div")!;
      expect(within(container).getByText("Veterinário Chefe")).toBeInTheDocument();
    });

    it("10. only role / accessLevel present: fails closed to '--' and access values MUST NOT appear", () => {
      profileDataState.user = mockUser({
        accessLevel: "administrador",
        role: "admin",
      });
      render(<MePage />);

      const label = screen.getByText("Função");
      const container = label.closest("div")!;
      expect(within(container).getByText("--")).toBeInTheDocument();
      expect(within(container).queryByText("admin")).not.toBeInTheDocument();
      expect(within(container).queryByText("administrador")).not.toBeInTheDocument();
    });
  });

  describe("/ME — Institutional Email", () => {
    it("11. institutional_email present: displays it", () => {
      profileDataState.user = mockUser({
        institutional_email: "boris.me@policia.sp.gov.br",
      });
      render(<MePage />);

      const label = screen.getByText("E-mail");
      const container = label.closest("div")!;
      expect(
        within(container).getByText("boris.me@policia.sp.gov.br"),
      ).toBeInTheDocument();
    });

    it("12. institutionalEmail fallback: displays it", () => {
      profileDataState.user = mockUser({
        institutionalEmail: "boris.me.alias@policia.sp.gov.br",
      });
      render(<MePage />);

      const label = screen.getByText("E-mail");
      const container = label.closest("div")!;
      expect(
        within(container).getByText("boris.me.alias@policia.sp.gov.br"),
      ).toBeInTheDocument();
    });

    it("13. generic email only: fails closed to '--' and generic account email MUST NOT be used", () => {
      profileDataState.user = mockUser({
        email: "boris.account@firebase.internal",
      });
      render(<MePage />);

      const label = screen.getByText("E-mail");
      const container = label.closest("div")!;
      expect(within(container).getByText("--")).toBeInTheDocument();
      expect(
        within(container).queryByText("boris.account@firebase.internal"),
      ).not.toBeInTheDocument();
    });
  });

  describe("HISTORY — Cargo / Função", () => {
    it("14. cargo present: history subline uses cargo", () => {
      profileDataState.user = mockUser({
        cargo: "Instrutor Chefe K9",
        unit: "Canil Central",
      });
      render(<HumanHistoryPage />);

      expect(
        screen.getByText("Instrutor Chefe K9 · Canil Central"),
      ).toBeInTheDocument();
    });

    it("15. função fallback: history subline uses função", () => {
      profileDataState.user = mockUser({
        função: "Auxiliar Veterinário",
        unit: "Base Alpha",
      });
      render(<HumanHistoryPage />);

      expect(
        screen.getByText("Auxiliar Veterinário · Base Alpha"),
      ).toBeInTheDocument();
    });

    it("16. accessLevel only: fails closed to 'Função não informada' and accessLevel MUST NOT appear as cargo/função", () => {
      profileDataState.user = mockUser({
        accessLevel: "operador_k9",
        unit: "Canil Central",
      });
      render(<HumanHistoryPage />);

      expect(
        screen.getByText("Função não informada · Canil Central"),
      ).toBeInTheDocument();
      expect(screen.queryByText(/operador_k9/)).not.toBeInTheDocument();
    });
  });

  describe("ACCESS FIELD NON-REGRESSION", () => {
    it("17. explicit 'Acesso' row in Profile continues to resolve Access data normally", () => {
      profileDataState.user = mockUser({
        access_profile_id: "gestor",
        cargo: "Condutor K9",
      });
      render(<HumanProfilePage />);

      const accessLabel = screen.getByText("Acesso");
      const accessContainer = accessLabel.closest("div")!;
      expect(within(accessContainer).getByText("Gestor / Comando")).toBeInTheDocument();

      const funcaoLabel = screen.getByText("Função");
      const funcaoContainer = funcaoLabel.closest("div")!;
      expect(within(funcaoContainer).getByText("Condutor K9")).toBeInTheDocument();
    });
  });

  describe("ALIAS PRECEDENCE — canonical key wins when BOTH Personnel aliases are populated", () => {
    it("18. `cargo` outranks `função` on Profile, /me and History Cargo surfaces", () => {
      const canonicalCargo = "Condutor K9 CANONICAL";
      const fallbackCargo = "Fallback Função SHOULD-NOT-WIN";

      // Fallback alias is declared FIRST on purpose: precedence must come from
      // the humanText(...) key order, never from object insertion order.
      profileDataState.user = mockUser({
        função: fallbackCargo,
        cargo: canonicalCargo,
        unit: "Canil Central",
      });

      // Surface 1 — Human Profile
      render(<HumanProfilePage />);
      const profileFuncao = screen.getByText("Função").closest("div")!;
      expect(within(profileFuncao).getByText(canonicalCargo)).toBeInTheDocument();
      expect(
        within(profileFuncao).queryByText(fallbackCargo),
      ).not.toBeInTheDocument();
      cleanup();

      // Surface 2 — /me
      render(<MePage />);
      const meFuncao = screen.getByText("Função").closest("div")!;
      expect(within(meFuncao).getByText(canonicalCargo)).toBeInTheDocument();
      expect(within(meFuncao).queryByText(fallbackCargo)).not.toBeInTheDocument();
      cleanup();

      // Surface 3 — Human History hero subline
      render(<HumanHistoryPage />);
      const historySubline = screen.getByText(
        `${canonicalCargo} · Canil Central`,
      );
      expect(historySubline).toBeInTheDocument();
      expect(historySubline.textContent).not.toContain(fallbackCargo);
    });

    it("19. `institutional_email` outranks `institutionalEmail` on Profile and /me email surfaces", () => {
      const canonicalEmail = "canonical.personnel@corp.invalid";
      const fallbackEmail = "fallback.personnel@corp.invalid";

      // Fallback alias declared FIRST on purpose (see test 18).
      profileDataState.user = mockUser({
        institutionalEmail: fallbackEmail,
        institutional_email: canonicalEmail,
      });

      // Surface 1 — Human Profile
      render(<HumanProfilePage />);
      const profileEmail = screen
        .getByText("E-mail institucional")
        .closest("div")!;
      expect(within(profileEmail).getByText(canonicalEmail)).toBeInTheDocument();
      expect(
        within(profileEmail).queryByText(fallbackEmail),
      ).not.toBeInTheDocument();
      cleanup();

      // Surface 2 — /me
      render(<MePage />);
      const meEmail = screen.getByText("E-mail").closest("div")!;
      expect(within(meEmail).getByText(canonicalEmail)).toBeInTheDocument();
      expect(within(meEmail).queryByText(fallbackEmail)).not.toBeInTheDocument();
    });
  });
});
