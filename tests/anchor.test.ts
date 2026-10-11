describe("Profile PDA", function () {
  this.timeout(120000);

  const owner = web3.Keypair.generate();
  const stranger = web3.Keypair.generate();

  const [profilePda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), owner.publicKey.toBuffer()],
    pg.program.programId
  );

  const options = {
    commitment: "confirmed" as const,
    preflightCommitment: "confirmed" as const,
  };

  async function readProfile(expectedBio: string) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const profile =
        await pg.program.account.profile.fetchNullable(
          profilePda,
          "confirmed"
        );

      if (profile !== null && profile.bio === expectedBio) {
        return profile;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error("Не удалось прочитать ожидаемые данные профиля");
  }

  async function expectError(
    action: () => Promise<unknown>,
    expectedCode: string
  ) {
    let caught: any;

    try {
      await action();
    } catch (error) {
      caught = error;
    }

    assert.ok(caught, "Ожидалась ошибка программы");

    const actualCode = caught?.error?.errorCode?.code;

    assert.equal(
      actualCode,
      expectedCode,
      `Ожидалась ${expectedCode}, получено: ${String(caught)}`
    );
  }

  before(async () => {
    const transaction = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: pg.wallet.publicKey,
        toPubkey: owner.publicKey,
        lamports: 10_000_000,
      }),
      web3.SystemProgram.transfer({
        fromPubkey: pg.wallet.publicKey,
        toPubkey: stranger.publicKey,
        lamports: 1_000_000,
      })
    );

    await web3.sendAndConfirmTransaction(
      pg.connection,
      transaction,
      [pg.wallet.keypair],
      options
    );

    console.log("Test profile PDA:", profilePda.toBase58());
  });

  it("Creates a profile", async () => {
    await pg.program.methods
      .createProfile("Karina", "Initial bio")
      .accounts({
        profile: profilePda,
        owner: owner.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc(options);

    const profile = await readProfile("Initial bio");

    assert.equal(profile.name, "Karina");
    assert.equal(profile.bio, "Initial bio");
    assert.equal(
      profile.owner.toBase58(),
      owner.publicKey.toBase58()
    );
  });

  it("Allows the owner to update the profile", async () => {
    await pg.program.methods
      .updateProfile("Karina Updated", "Updated bio")
      .accounts({
        profile: profilePda,
        owner: owner.publicKey,
      })
      .signers([owner])
      .rpc(options);

    const profile = await readProfile("Updated bio");

    assert.equal(profile.name, "Karina Updated");
    assert.equal(profile.bio, "Updated bio");
  });

  it("Rejects an update from another wallet", async () => {
    await expectError(
      () =>
        pg.program.methods
          .updateProfile("Stranger", "Changed by stranger")
          .accounts({
            profile: profilePda,
            owner: stranger.publicKey,
          })
          .signers([stranger])
          .rpc(options),
      "Unauthorized"
    );

    const profile = await readProfile("Updated bio");

    assert.equal(profile.name, "Karina Updated");
    assert.equal(profile.bio, "Updated bio");
    assert.equal(
      profile.owner.toBase58(),
      owner.publicKey.toBase58()
    );
  });

  it("Rejects an empty name and oversized data", async () => {
    const cases = [
      { name: "   ", bio: "Valid bio", code: "EmptyName" },
      {
        name: "a".repeat(33),
        bio: "Valid bio",
        code: "NameTooLong",
      },
      {
        name: "Karina",
        bio: "b".repeat(257),
        code: "BioTooLong",
      },
    ];

    for (const testCase of cases) {
      await expectError(
        () =>
          pg.program.methods
            .updateProfile(testCase.name, testCase.bio)
            .accounts({
              profile: profilePda,
              owner: owner.publicKey,
            })
            .signers([owner])
            .rpc(options),
        testCase.code
      );
    }

    const profile = await readProfile("Updated bio");

    assert.equal(profile.name, "Karina Updated");
    assert.equal(profile.bio, "Updated bio");
  });
});
