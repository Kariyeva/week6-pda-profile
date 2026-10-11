const owner = pg.wallet.publicKey;

const [profilePda, bump] = web3.PublicKey.findProgramAddressSync(
  [Buffer.from("profile"), owner.toBuffer()],
  pg.program.programId
);

const options = {
  commitment: "confirmed" as const,
  preflightCommitment: "confirmed" as const,
};

async function readProfile(expectedBio?: string) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const profile = await pg.program.account.profile.fetchNullable(
      profilePda,
      "confirmed"
    );

    if (
      profile !== null &&
      (expectedBio === undefined || profile.bio === expectedBio)
    ) {
      return profile;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Не удалось прочитать ожидаемые данные профиля");
}

console.log("Program ID:", pg.program.programId.toString());
console.log("Owner:", owner.toString());
console.log("Profile PDA:", profilePda.toString());
console.log("Bump:", bump);

const existing = await pg.program.account.profile.fetchNullable(
  profilePda,
  "confirmed"
);

if (existing === null) {
  const signature = await pg.program.methods
    .createProfile("Karina", "Изучаю Solana и Anchor")
    .accounts({
      profile: profilePda,
      owner,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc(options);

  console.log(
    "Create transaction:",
    `https://explorer.solana.com/tx/${signature}?cluster=devnet`
  );
} else {
  console.log("Profile already exists");
}

let profile = await readProfile();

console.log("Before update:");
console.log("Name:", profile.name);
console.log("Bio:", profile.bio);

const updatedBio = "Создала профиль на PDA в Devnet";

const updateSignature = await pg.program.methods
  .updateProfile("Karina", updatedBio)
  .accounts({
    profile: profilePda,
    owner,
  })
  .rpc(options);

profile = await readProfile(updatedBio);

console.log("After update:");
console.log("Name:", profile.name);
console.log("Bio:", profile.bio);
console.log("Stored owner:", profile.owner.toString());

console.log(
  "Update transaction:",
  `https://explorer.solana.com/tx/${updateSignature}?cluster=devnet`
);

console.log(
  "Profile account:",
  `https://explorer.solana.com/address/${profilePda}?cluster=devnet`
);
