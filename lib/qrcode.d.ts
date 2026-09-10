declare module "qrcode" {
  export function toDataURL(text: string | Array<any>, options?: any): Promise<string>;
  export function toString(text: string | Array<any>, options?: any): Promise<string>;
}
