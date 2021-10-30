import dotenv from 'dotenv';

export async function mochaGlobalSetup() {
  dotenv.config();
  console.log("GlobalSetupFixtures executed.");
}

export async function mochaGlobalTeardown() {
  console.log('MochaGlobalTeardown executed.');
}
