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
      "scrypt$16384$8$1$NCaeCcUlWlfsTkgSULetjA$lOiM5QevHz8Mwcj7pjk8Ode7Ak1AzodlovaCkzQJHU0",
  },
  {
    username: "og02",
    teamId: "og-02",
    name: "OG 02",
    passwordHash:
      "scrypt$16384$8$1$017383Vji_LPL4XuEtXfTg$3ZNlllfTLkm9vLnpeJkF2o-qN7Asl0Pm4LDlUbeRKUc",
  },
  {
    username: "og03",
    teamId: "og-03",
    name: "OG 03",
    passwordHash:
      "scrypt$16384$8$1$ntYFZQwTFpzVUUz-gqyJ4Q$0jzI3Q35hdRXnJfxLQ5GszoZAxyHJz7UMzV22qAeE4w",
  },
  {
    username: "og04",
    teamId: "og-04",
    name: "OG 04",
    passwordHash:
      "scrypt$16384$8$1$ZJnsSnNPs3WAqfyJ9tMNWg$jfH9lI884Htd8vhjxJRQyo2UKVgrr8mPBVEjnT7wrOU",
  },
  {
    username: "og05",
    teamId: "og-05",
    name: "OG 05",
    passwordHash:
      "scrypt$16384$8$1$Pg9nb-lsAL_3jt1pNNAwkg$p7WxhXIHTGATRp3CHTy90KWtGWLQQk9pClkmgpLqvr4",
  },
  {
    username: "og06",
    teamId: "og-06",
    name: "OG 06",
    passwordHash:
      "scrypt$16384$8$1$b4pkBWh-PFDHp1aqlOMgSA$KJVFcZ3Svf_AS3ZlkXstWXVONFzACKa9o_1pkkXS0hU",
  },
  {
    username: "og07",
    teamId: "og-07",
    name: "OG 07",
    passwordHash:
      "scrypt$16384$8$1$FHiP12TfwTqERk46_BamKg$NdPmlbmRGtSd3razFQRI6S58vFWF9Zj9wOUcdGdCHuM",
  },
  {
    username: "og08",
    teamId: "og-08",
    name: "OG 08",
    passwordHash:
      "scrypt$16384$8$1$a1d2LkOoUNE6ZdWvg6e0Ow$tGtiylVFkX8n6W3ErbI-XRZdqfG_3_0mG-4cd_FfWqI",
  },
  {
    username: "og09",
    teamId: "og-09",
    name: "OG 09",
    passwordHash:
      "scrypt$16384$8$1$Jt7vsVDCdj1CwvbnDcJ4pA$SWxP7wIuUvQZhHNxl1YVAhPtr_zldX5L5DLDnT9Ejm4",
  },
  {
    username: "og10",
    teamId: "og-10",
    name: "OG 10",
    passwordHash:
      "scrypt$16384$8$1$-bZxYNVXgapuBI1xYUC9UA$0R_dWZVkYEJZUgSfz__kvOlbZDGG605Vn2fG10ChQhg",
  },
  {
    username: "og11",
    teamId: "og-11",
    name: "OG 11",
    passwordHash:
      "scrypt$16384$8$1$siFAR4fFrC2p5dbNZWyqXA$1rlY6HOgMWWPqT4OeFhxMLvJrflKEYfpcX4RwF-saCU",
  },
  {
    username: "og12",
    teamId: "og-12",
    name: "OG 12",
    passwordHash:
      "scrypt$16384$8$1$x6rGApOgcMBwedxC8Fqe-A$2nL5EJB2NMWL8HEPwpv204HPPBpsVMqCHTc1n25ukc0",
  },
] as const;

export function getOgAccountByUsername(
  username: string,
): OgAccount | undefined {
  const normalized = username.trim().toLowerCase();
  return OG_ACCOUNTS.find((account) => account.username === normalized);
}

