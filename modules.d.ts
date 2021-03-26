declare namespace NodeJS {
  export interface ProcessEnv {
    TOKEN: string;
    NODE_ENV: 'development' | 'production';
  }
}