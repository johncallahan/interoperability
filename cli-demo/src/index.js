#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vorpal = require("vorpal")();

const logger = require("./logger");
const packageJson = require("../package.json");

const resolver = require("./resolver");

const ES256K = require("@transmute/es256k-jws-ts");

const defaultExpiresInHours = 99999;

const { version } = packageJson;
vorpal.packageJson = packageJson;
vorpal.logger = logger;
vorpal.wait = seconds =>
  new Promise(resolve => {
    setTimeout(resolve, seconds * 1000);
  });

vorpal.command("version", "display version").action(async () => {
  await vorpal.logger.log({
    level: "info",
    message: `version ${version}`
  });
  // eslint-disable-next-line
  console.log(
    JSON.stringify(
      {
        "interop-cli-demo": version
      },
      null,
      2
    )
  );
  return vorpal.wait(1);
});

vorpal.command("resolve <did>", "resolve a did").action(async args => {
  const { did } = args;
  const ddo = await resolver.resolve(did);
  // eslint-disable-next-line
  console.log(
    JSON.stringify(
      {
        ...ddo
      },
      null,
      2
    )
  );
  return vorpal.wait(1);
});

vorpal
  .command(
    "issue <issuerDid> <pathToPrivateKeyJwk> <subjectDid> <pathToClaim> <outputPath>",
    "Create a JWS VC"
  )
  .action(async args => {
    const claim = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), args.pathToClaim)).toString()
    );

    const privateKeyJwk = JSON.parse(
      fs
        .readFileSync(path.resolve(process.cwd(), args.pathToPrivateKeyJwk))
        .toString()
    );

    const innerPayload = {
      iss: args.issuerDid,
      sub: args.subjectDid,
      ...claim,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * defaultExpiresInHours
    };
    const vc = await ES256K.JWS.sign(innerPayload, privateKeyJwk, {
      alg: "ES256K",
      kid: privateKeyJwk.kid
    });

    fs.writeFileSync(args.outputPath, vc);

    // eslint-disable-next-line
    console.log(
      JSON.stringify(
        {
          vc
        },
        null,
        2
      )
    );
  });

vorpal.command("verify <pathToVC> ", "Verify a JWS VC").action(async args => {
  const vcJws = fs
    .readFileSync(path.resolve(process.cwd(), args.pathToVC))
    .toString();

  const vcDecoded = await ES256K.JWS.decode(vcJws, { complete: true });

  const ddo = await resolver.resolve(vcDecoded.payload.iss);

  const publicKeyFromResolver = ddo.publicKey.find(k => {
    return k.id === vcDecoded.payload.iss + "#key-" + vcDecoded.header.kid;
  });

  const verified = await ES256K.JWS.verify(
    vcJws,
    publicKeyFromResolver.publicKeyJwk
  );

  // eslint-disable-next-line
  console.log(
    JSON.stringify(
      {
        verified
      },
      null,
      2
    )
  );
});

vorpal
  .command("publicKeyHexToPublicKeyJwk <publicKeyHex>", "convert key format")
  .action(async args => {
    const publicKeyJwk = await ES256K.keyUtils.publicJWKFromPublicKeyHex(
      args.publicKeyHex
    );
    // eslint-disable-next-line
    console.log(
      JSON.stringify(
        {
          ...publicKeyJwk
        },
        null,
        2
      )
    );
  });

vorpal
  .command("privateKeyHexToPublicKeyJwk <privateKeyHex>", "convert key format")
  .action(async args => {
    const privateKeyJwk = await ES256K.keyUtils.privateJWKFromPrivateKeyHex(
      args.privateKeyHex
    );
    // eslint-disable-next-line
    console.log(
      JSON.stringify(
        {
          ...privateKeyJwk
        },
        null,
        2
      )
    );
  });

vorpal.parse(process.argv);
if (process.argv.length === 0) {
  vorpal.delimiter("🤝🏼 ").show();
}