import "server-only";

export type OgAccount = {
  username: string;
  teamId: string;
  name: string;
  /** Encoded scrypt parameters, salt, and derived key. Never plaintext. */
  passwordHash: string;
};

export const OG_ACCOUNTS: readonly OgAccount[] = [
  {
    username: "og01",
    teamId: "og-01",
    name: "OG 01",
    passwordHash:
      "scrypt$16384$8$1$TgOlsWYIyVbwnbHZfYprIQ$ChLoBaAPVJKc2amTN9ssYcW4YEfVOn-DgCc0rS983ic",
  },
  {
    username: "og02",
    teamId: "og-02",
    name: "OG 02",
    passwordHash:
      "scrypt$16384$8$1$SHiISPXh2YrHgcX_03zLJA$WlC1wcOb0acOtEMiIslO91j9RWveOMFyyi9k81MepDs",
  },
  {
    username: "og03",
    teamId: "og-03",
    name: "OG 03",
    passwordHash:
      "scrypt$16384$8$1$VGTpZUYrLqIkZg_bSzzUmA$KjPA8REFwDwvPfvF4-kFgLRHuI_w7xToMg4ueF8B80Q",
  },
  {
    username: "og04",
    teamId: "og-04",
    name: "OG 04",
    passwordHash:
      "scrypt$16384$8$1$KYlx6SS_hs6_mI2_KRk-yw$LuxzCNjGUuBvpkOoLmi-g5rr8uzd-WUT9TdyAgZr2Zs",
  },
  {
    username: "og05",
    teamId: "og-05",
    name: "OG 05",
    passwordHash:
      "scrypt$16384$8$1$mIOe5CB1psFSZB0uhJ0sTw$xycaOHRaqJoLfRjerMPbGck_YMtJXQfXPaFLS_BtusU",
  },
  {
    username: "og06",
    teamId: "og-06",
    name: "OG 06",
    passwordHash:
      "scrypt$16384$8$1$Kl3N2VjFuT6mEQb62thbnQ$-Yw5HBcTlGDAefmmpar8cdhrBotNvPGxFi8qIo9SSVc",
  },
  {
    username: "og07",
    teamId: "og-07",
    name: "OG 07",
    passwordHash:
      "scrypt$16384$8$1$FpXAJj8mcQCxcdAALY9ifA$04TA3gwwqUePuTacfW0WkWU3SyqmwFoL0dBCw6t4HF0",
  },
  {
    username: "og08",
    teamId: "og-08",
    name: "OG 08",
    passwordHash:
      "scrypt$16384$8$1$fJrpKeA0Izz6fSrI4F-YiQ$T_PcZH4T-A985tcSAh13TsovOBepqh6WP4QmWhtEW4o",
  },
  {
    username: "og09",
    teamId: "og-09",
    name: "OG 09",
    passwordHash:
      "scrypt$16384$8$1$aYBDO3YcvvuPlb0LTqhxiQ$fFRY39baSigsmgwRBoyN7a1LICBGKX2O9LRTDYrW5PQ",
  },
  {
    username: "og10",
    teamId: "og-10",
    name: "OG 10",
    passwordHash:
      "scrypt$16384$8$1$0z1D7WFSONcZXcQpBKgjGw$PY40-OsFIu-Am9hdPdn9v8GZSVVjmAZD5OnA3o2h5ro",
  },
  {
    username: "og11",
    teamId: "og-11",
    name: "OG 11",
    passwordHash:
      "scrypt$16384$8$1$eZbSOtGUqUAhHnZ7kSh78Q$vYdiy63TBwuA6a7q7EpD-jEZbiVIAVrsjMteejk3P7o",
  },
  {
    username: "og12",
    teamId: "og-12",
    name: "OG 12",
    passwordHash:
      "scrypt$16384$8$1$6BDZVXXeRK9ycOT-y3lrSg$XxfLNMua_xg2OhmTfpweLMCQyc_LYbSvj9SO4FHS-D4",
  },
] as const;

export function getOgAccountByUsername(
  username: string,
): OgAccount | undefined {
  const normalized = username.trim().toLowerCase();
  return OG_ACCOUNTS.find((account) => account.username === normalized);
}
