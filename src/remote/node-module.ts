/** Browser Loader never uses its server-side require fallback. */
export function createRequire(): (id: string) => never { return id => { throw new Error(`远程浏览器不支持加载本机 Node 模块：${id}`) } }
