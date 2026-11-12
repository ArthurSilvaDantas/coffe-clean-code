// Somente a suíte original do projeto (antes da análise dos mutantes vivos)
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/mutacao/'],
};
