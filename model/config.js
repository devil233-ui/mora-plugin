import YAML from 'yaml'
import chokidar from 'chokidar'
import fs from 'node:fs'
import nodePath from 'node:path'
import { promisify } from 'node:util'
import _ from 'lodash'
import { Data, isV3, pluginPath } from '../components/index.js'

/**
 * 配置文件
 * 借鉴逍遥插件
 * 新增热加载支持
 */
class moracfg {
  constructor () {
    this.def = `${pluginPath}/config/default/`
    this.user = `${pluginPath}/config/user/`
    // 配置缓存
    this._cache = {}
    // 文件监听器
    this._watchers = {}
  }

  get resNotFound () {
    return '还没下载/更新资源包，该功能用不了捏\n请发送【#更新摩拉资源】以进行更新'
  }

  /** 通用yaml读取 */
  getfileYaml (path, name) {
    let file = `${path}${name}.yaml`
    return fs.existsSync(file) ? YAML.parse(fs.readFileSync(file, 'utf8')) : {}
  }

  /** 
   * 带缓存和热加载的yaml读取
   * @param {string} path - 配置目录路径
   * @param {string} name - 配置文件名（不含扩展名）
   * @returns {object} 配置对象
   */
  getConfigWithCache (path, name) {
    const cacheKey = `${path}${name}`
    const file = `${path}${name}.yaml`
    
    // 如果缓存中不存在，先读取
    if (!this._cache[cacheKey]) {
      this._cache[cacheKey] = this.getfileYaml(path, name)
      // 设置文件监听
      this._watchConfigFile(file, cacheKey)
    }
    
    return this._cache[cacheKey]
  }

  /**
   * 监听配置文件变化
   * @param {string} file - 文件路径
   * @param {string} cacheKey - 缓存键
   */
  _watchConfigFile (file, cacheKey) {
    // 如果已经在监听，跳过
    if (this._watchers[cacheKey]) return
    
    // 文件不存在则不监听
    if (!fs.existsSync(file)) return

    const watcher = chokidar.watch(file, {
      persistent: true,
      ignoreInitial: true
    })

    watcher.on('change', () => {
      try {
        // 重新读取配置
        const newConfig = this.getfileYaml(nodePath.dirname(file) + '/', nodePath.basename(file, '.yaml'))
        this._cache[cacheKey] = newConfig
        console.log(`[mora-plugin][配置文件修改] ${nodePath.basename(file)}`)
      } catch (err) {
        console.error(`[mora-plugin][配置文件读取失败] ${file}: ${err}`)
      }
    })

    this._watchers[cacheKey] = watcher
  }

  /**
   * 清除配置缓存（用于手动刷新）
   * @param {string} path - 配置目录路径
   * @param {string} name - 配置文件名
   */
  clearCache (path, name) {
    const cacheKey = `${path}${name}`
    delete this._cache[cacheKey]
    if (this._watchers[cacheKey]) {
      this._watchers[cacheKey].close()
      delete this._watchers[cacheKey]
    }
  }

  /** 设置读取 */
  getSetYaml (name, isCopy = false) {
    if (isCopy) this.defSetCopy(name)

    let setPath = fs.existsSync(`${this.user + name}.yaml`) ? this.user : this.def
    return this.getfileYaml(setPath, name)
  }

  /** 配置拷贝 */
  defSetCopy (name) {
    name += '.yaml'
    if (!fs.existsSync(this.user)) fs.mkdirSync(this.user)

    if (!fs.existsSync(this.user + name)) fs.copyFileSync(this.def + name, this.user + name)
  }

  getMoraPath (name) {
    let path = pluginPath
    switch (name) {
      case 'def':
        path = this.def
        break
      case 'user':
        path = this.user
        break
      case 'res':
        path += '/resources/'
        break
      case 'plus':
        path += '/resources/mora-plugin-res/'
        break
      case 'data':
        path += '/data/'
        break
    }
    return path
  }

  getGameRes (name) {
    let path = this.getMoraPath('plus')
    switch (name) {
      case 'banner':
        path += 'Banners'
        break
      case 'gs':
        path += 'Genshin/'
        break
      case 'sr':
        path += 'StarRail/'
        break
      case 'zzz':
        path += 'ZenlessZoneZero/'
        break
    }
    return path
  }

  getMoraPlus (model, name) {
    let path = this.getGameRes(model)
    switch (name) {
      case 'role':
        path += 'Roles'
        break
      case 'team':
        path += 'TeamGuides'
        break
      case 'abyss':
        path += 'Abyss'
        break
      case 'chaos':
        path += 'Chaos'
        break
    }
    return path
  }
}

export default new moracfg()
