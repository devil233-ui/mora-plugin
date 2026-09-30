import fetch from 'node-fetch'
import fs from 'node:fs'
import path from 'node:path'
import common from '../../../lib/common/common.js'
import { pluginPath, moraVer, yzInfo } from '../components/index.js'
import _ from 'lodash'
import moracfg from './config.js'

/**
 * 米游社域名节点优选（云崽 lib/common/mys.js）
 *
 * 米游社各域名的 DNS 会一次返回一批 CDN 节点，其中常有整段网段从本机不可达：
 * 命中时原生 fetch 要么连等 10s 连接超时，要么因为 undici 的 headersTimeout
 * 高达 300s 而静默挂住几分钟（攻略图下载「下着就没动静」就是这个原因）。
 * mysFetch 会先并发测速挑可达节点，并在失败时换 IP 重试。
 *
 * 本插件是独立 fork，别的云崽上没有这个模块，缺失时回退原生 fetch，
 * 不让一个 import 把整个插件加载搞挂。
 */
let mysFetch = null
try {
  ({ mysFetch } = await import('../../../lib/common/mys.js'))
} catch (err) {
  console.warn('[摩拉插件] 未找到云崽米游社请求入口 lib/common/mys.js，改用原生 fetch：', err?.message)
}

class commonTools {
  constructor () {
    this._path = process.cwd()
    this.rolePicPath = `${pluginPath}/resources/img/role/`
  }

  /**
   * 统一出网入口：优先走节点优选，缺失时回退原生 fetch
   * @param {string} url 访问地址
   * @param {object} options 另有 timeout（默认 8000）/ retry / ttl 等扩展项
   * @returns 类 fetch 的响应对象
   */
  request (url, options) {
    return mysFetch ? mysFetch(url, options) : fetch(url, options)
  }

  /**
   * 获取数据
   * @param {string} url 访问地址
   * @returns 数据
   */
  async getFetchData (url) {
    let response = await this.request(url, { method: 'get', timeout: 8000, retry: 3 })
    if (!response.ok) return false

    const res = await response.json()
    return res
  }

  /**
   * 截图模板
   * @param {Object} parent 父级目录
   * @param {String} model 模型名称
   * @param {Object} data 数据
   * @returns 数据渲染模板
   */
  async getRenderData (parent, model, data) {
    return {
      tplFile: `${pluginPath}/resources/html/${parent}/${model}.html`,
      pluResPath: `${pluginPath}/resources/`,
      profilePic: this.rolePicPath,
      watermark: `Created By Yunzai-Bot ${yzInfo.version} & Mora-Plugin ${moraVer}`,
      quality: 100,
      ...data
    }
  }

  /**
   * 下载文件
   *
   * 刻意自己取 buffer 落盘，不再走云崽的 common.downFile / Bot.download。
   * 原实现是「先 fetch 一次只为看 ok，再交给 Bot.download 真正下载」，而
   * Bot.download 内部用的是云崽的全局 fetch，插件侧改不动，照样会命中坏节点
   * 静默挂几分钟，等于没修。
   *
   * 图片 CDN 的节点有两种坏法：
   *   1) TCP 直接不可达 —— mysFetch 内部会自己换节点；
   *   2) TCP 通、但会改写 query 里的 OSS 参数，回源后 OSS 报 400
   *      （实测 180.163.147.x 那一批就是这样）。mysFetch 按设计只在连接类
   *      错误时换节点、拿到 HTTP 响应就返回，所以这里在业务层再换一批重试。
   */
  async download (url, sfPath) {
    const MAX_ATTEMPT = 3
    let lastStatus = 0

    for (let attempt = 1; attempt <= MAX_ATTEMPT; attempt++) {
      try {
        const res = await this.request(url, {
          timeout: 15000,
          retry: 3,
          // 第 2 次起强制重新解析 DNS 并重新测速：沿用缓存的池只会挑到同一个
          // 节点，等于白试。实测 ttl:0 每次能换到另一批节点。
          ...(attempt > 1 ? { ttl: 0 } : {})
        })
        lastStatus = res.status

        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer())
          if (buffer.length) {
            const dir = path.dirname(sfPath)
            if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(sfPath, buffer)
            return { url, file: sfPath, buffer }
          }
        } else if (attempt < MAX_ATTEMPT) {
          console.warn(`[摩拉插件] 下载返回 HTTP ${res.status}（第 ${attempt}/${MAX_ATTEMPT} 次），换一批节点重试：${url}`)
        }
      } catch (err) {
        if (attempt < MAX_ATTEMPT) {
          console.warn(`[摩拉插件] 下载失败（第 ${attempt}/${MAX_ATTEMPT} 次尝试）：${err?.message} ${url}`)
        } else {
          console.warn(`[摩拉插件] 下载最终失败：${err?.message} ${url}`)
        }
      }
    }

    if (lastStatus) console.warn(`[摩拉插件] 下载最终失败（HTTP ${lastStatus}）：${url}`)
    return false
  }

  get travelerID () {
    return [10000005, 10000007, 20000000]
  }

  /** 主角特殊处理 */
  traveler (alias, name, type) {
    let travelers = ['风主', '岩主', '雷主', '水主', '火主']
    if (!travelers.includes(alias)) {
      travelers = _.map(travelers, v => `${v}${type}`)
      return `请选择${name}${type}：${_.join(travelers, '、')}`
    } else return alias
  }

  trailblazer (name, type) {
    let trailblazers = {
      物主: { ids: [8001, 8002], alias: ['物', '物理', '毁灭'] },
      火主: { ids: [8003, 8004], alias: ['火', '存护'] },
      虚数主: { ids: [8005, 8006], alias: ['虚数', '同谐', '同协', '虚'] },
      冰主: { ids: [8007, 8008], alias: ['冰', '记忆'] },
    }

    const alias = ['主', '主角', '爷', '开拓者', '星', '穹']

    if (_.tail(alias).includes(name)) {
      trailblazers = _.map(_.keys(trailblazers), v => `${v}${type}`)
      return `请选择${name}${type}：${_.join(trailblazers, '、')}`
    } else {
      let find = _.find(trailblazers, v => new RegExp(`(${v.alias.join('|')})(${alias.join('|')})`).test(name))
      if (find) {
        return {
          name: `${find.alias[0]}主`,
          roleId: find.ids[0],
          reg: `(${find.alias.join('|')})(${_.take(alias, 4).join('|')})`
        }
      }
    }
  }

  async makeMsg (e, data = [], title = '', force = false) {
    const forwardMsg = moracfg.getSetYaml('config', true).forwardMsg
    if (data.length === 1) return data[0]
    else if (forwardMsg || force) return await common.makeForwardMsg(e, data, title)
    else return [title, ...data]
  }
}

export default new commonTools()
