import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 日志工具 - 根据log开关控制输出
class Logger {
  constructor() {
    this.logConfig = {
      error: true,
      log: false,
      mark: true,
      warn: true,
      info: true
    }
  }

  setLogConfig(config) {
    if (typeof config === 'object' && config !== null) {
      this.logConfig.error = config.error !== false
      this.logConfig.log = config.log === true || config.log === 1 || config.log === 'true'
      this.logConfig.mark = config.mark !== false
      this.logConfig.warn = config.warn !== false
      this.logConfig.info = config.info !== false
    }
  }

  // 兼容旧方法
  setLogEnabled(enabled) {
    this.logConfig.log = enabled === true || enabled === 1 || enabled === 'true'
  }

  log(...args) {
    if (this.logConfig.log) {
      console.log('[摩拉插件]', ...args)
    }
  }

  info(...args) {
    if (this.logConfig.info) {
      console.info('[摩拉插件]', ...args)
    }
  }

  error(...args) {
    if (this.logConfig.error) {
      console.error('[摩拉插件]', ...args)
    }
  }

  mark(...args) {
    if (this.logConfig.mark) {
      console.log('[摩拉插件][MARK]', ...args)
    }
  }

  warn(...args) {
    if (this.logConfig.warn) {
      console.warn('[摩拉插件]', ...args)
    }
  }
}

const logger = new Logger()

// YAML工具函数
async function readYAML(filePath) {
  try {
    const fs = await import('fs')
    const yaml = await import('yaml')
    if (!fs.existsSync(filePath)) {
      logger.log(`YAML文件不存在: ${filePath}`)
      return null
    }
    logger.log(`读取YAML文件: ${filePath}`)
    const file = fs.readFileSync(filePath, 'utf8')
    const data = yaml.parse(file)
    logger.log(`YAML文件读取成功:`, data)
    return data || {}
  } catch (error) {
    logger.error(`读取YAML文件失败: ${filePath}`, error)
    return null
  }
}

async function writeYAML(filePath, data) {
  try {
    const fs = await import('fs')
    const yaml = await import('yaml')
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const yamlStr = yaml.stringify(data)
    fs.writeFileSync(filePath, yamlStr, 'utf8')
    return true
  } catch (error) {
    logger.error(`写入YAML文件失败: ${filePath}`, error)
    throw error
  }
}

// 资源文件路径
const RESOURCE_FILES = {
  genshin: `${path.resolve(__dirname, '../')}/config/default/roleGuides.yaml`,
  starrail: `${path.resolve(__dirname, '../')}/config/default/srRoleGuides.yaml`,
  zzz: `${path.resolve(__dirname, '../')}/config/default/zzzRoleGuides.yaml`
}

// 配置管理器
class ConfigManager {
  constructor() {
    this.pluginRoot = path.resolve(__dirname, '../')
    this.configPath = {
      default: `${this.pluginRoot}/config/default`,
      user: `${this.pluginRoot}/config/user`
    }
    this._logConfig = null
    this._logConfigInitializing = false
  }

  // 获取log配置
  async getLogConfig() {
    // 如果正在初始化中，返回默认配置避免循环调用
    if (this._logConfigInitializing) {
      return { error: true, log: false, mark: true, warn: true }
    }
    
    if (this._logConfig === null) {
      this._logConfigInitializing = true
      try {
        const config = await this.getConfig('config')
        // 支持新的多级别日志配置和旧的单一配置
        this._logConfig = {
          error: config.logError !== false,  // 默认开启
          log: config.logLog === true || config.logLog === 1 || config.logLog === 'true',  // 默认关闭
          mark: config.logMark !== false,  // 默认开启
          warn: config.logWarn !== false   // 默认开启
        }
        // 兼容旧配置
        if (config.log !== undefined && config.logLog === undefined) {
          this._logConfig.log = config.log === true || config.log === 1 || config.log === 'true'
        }
        logger.setLogConfig(this._logConfig)
      } finally {
        this._logConfigInitializing = false
      }
    }
    return this._logConfig
  }

  // 刷新log配置
  async refreshLogConfig() {
    this._logConfig = null
    return await this.getLogConfig()
  }

  // 获取配置文件路径
  getConfigPath(name, useDefault = false) {
    const baseDir = useDefault ? this.configPath.default : this.configPath.user
    return `${baseDir}/${name}.yaml`
  }

  // 读取配置（优先读取user，如果不存在或无效则读取default）
  async getConfig(name) {
    const userPath = this.getConfigPath(name, false)
    const defaultPath = this.getConfigPath(name, true)

    logger.log(`尝试读取用户配置: ${userPath}`)
    let config = await readYAML(userPath)

    // 如果用户配置不存在，或者配置无效（空数组或所有字段都是null/空），则读取默认配置
    if (config === null || this.isConfigInvalid(config, name)) {
      if (config !== null) {
        logger.log(`用户配置无效，读取默认配置: ${defaultPath}`)
      } else {
        logger.log(`用户配置不存在，读取默认配置: ${defaultPath}`)
      }
      config = await readYAML(defaultPath)
    }

    if (config === null) {
      logger.log(`默认配置也不存在，返回空对象`)
      config = {}
    }

    logger.log(`配置 ${name} 读取结果:`, config)
    return config
  }

  // 判断配置是否无效（空数组或所有字段都是null/空）
  isConfigInvalid(config, name) {
    if (!config) return true

    // 如果是数组，检查是否为空数组
    if (Array.isArray(config)) {
      const isInvalid = config.length === 0
      if (isInvalid) logger.log(`配置 ${name} 是无效的空数组`)
      return isInvalid
    }

    // 如果是对象，检查是否所有字段都是null或空数组
    const values = Object.values(config)
    if (values.length === 0) return false // 空对象不算无效

    const isInvalid = values.every(val =>
      val === null ||
      val === undefined ||
      (Array.isArray(val) && val.length === 0) ||
      (typeof val === 'object' && val !== null && Object.keys(val).length === 0)
    )

    if (isInvalid) logger.log(`配置 ${name} 的所有字段都是无效值`)
    return isInvalid
  }

  // 保存配置到user目录
  async saveConfig(name, data) {
    const userPath = this.getConfigPath(name, false)
    return await writeYAML(userPath, data)
  }

  // 获取所有配置
  async getAllConfig() {
    // 先读取基础配置
    const [config, help] = await Promise.all([
      this.getConfig('config'),
      this.getConfig('help')
    ])

    // 先读取 user 目录的攻略配置（用于获取 all 开关状态）
    let roleGuidesUser = await this.getConfig('roleGuides')
    let srRoleGuidesUser = await this.getConfig('srRoleGuides')
    let zzzRoleGuidesUser = await this.getConfig('zzzRoleGuides')

    // 根据 all 开关决定使用哪个目录的配置
    // 原神
    let roleGuides
    // 处理 all 值（支持 true/false/1/0）
    const roleGuidesAll = roleGuidesUser && (roleGuidesUser.all === true || roleGuidesUser.all === 1 || roleGuidesUser.all === 'true')
    if (roleGuidesAll) {
      logger.log('原神攻略源 all=true，读取 default 目录配置')
      roleGuides = await readYAML(this.getConfigPath('roleGuides', true))
      // 保留 all 开关状态
      if (roleGuides) {
        roleGuides.all = true
      }
    } else {
      logger.log('原神攻略源 all=false 或未设置，读取 user 目录配置')
      roleGuides = roleGuidesUser
      if (roleGuides) {
        roleGuides.all = false
      }
    }

    // 星穹铁道
    let srRoleGuides
    // 处理 all 值（支持 true/false/1/0）
    const srRoleGuidesAll = srRoleGuidesUser && (srRoleGuidesUser.all === true || srRoleGuidesUser.all === 1 || srRoleGuidesUser.all === 'true')
    if (srRoleGuidesAll) {
      logger.log('星穹铁道攻略源 all=true，读取 default 目录配置')
      srRoleGuides = await readYAML(this.getConfigPath('srRoleGuides', true))
      if (srRoleGuides) {
        srRoleGuides.all = true
      }
    } else {
      logger.log('星穹铁道攻略源 all=false 或未设置，读取 user 目录配置')
      srRoleGuides = srRoleGuidesUser
      if (srRoleGuides) {
        srRoleGuides.all = false
      }
    }

    // 绝区零
    let zzzRoleGuides
    // 处理 all 值（支持 true/false/1/0）
    const zzzRoleGuidesAll = zzzRoleGuidesUser && (zzzRoleGuidesUser.all === true || zzzRoleGuidesUser.all === 1 || zzzRoleGuidesUser.all === 'true')
    if (zzzRoleGuidesAll) {
      logger.log('绝区零攻略源 all=true，读取 default 目录配置')
      zzzRoleGuides = await readYAML(this.getConfigPath('zzzRoleGuides', true))
      if (zzzRoleGuides) {
        zzzRoleGuides.all = true
      }
    } else {
      logger.log('绝区零攻略源 all=false 或未设置，读取 user 目录配置')
      zzzRoleGuides = zzzRoleGuidesUser
      if (zzzRoleGuides) {
        zzzRoleGuides.all = false
      }
    }

    // 处理星铁和绝区零配置：支持新格式 {all, list} 和旧格式（直接数组）
    let srRoleGuidesData
    if (srRoleGuides && typeof srRoleGuides === 'object' && !Array.isArray(srRoleGuides) && Array.isArray(srRoleGuides.list)) {
      // 新格式：{all, list: [...]}
      srRoleGuidesData = srRoleGuides.list
    } else if (Array.isArray(srRoleGuides)) {
      // 旧格式：直接数组
      srRoleGuidesData = srRoleGuides
    } else {
      srRoleGuidesData = []
    }

    let zzzRoleGuidesData
    if (zzzRoleGuides && typeof zzzRoleGuides === 'object' && !Array.isArray(zzzRoleGuides) && Array.isArray(zzzRoleGuides.list)) {
      // 新格式：{all, list: [...]}
      zzzRoleGuidesData = zzzRoleGuides.list
    } else if (Array.isArray(zzzRoleGuides)) {
      // 旧格式：直接数组
      zzzRoleGuidesData = zzzRoleGuides
    } else {
      zzzRoleGuidesData = []
    }

    // 读取 default 目录的配置用于只读显示
    const roleGuidesDefault = await readYAML(this.getConfigPath('roleGuides', true))
    const srRoleGuidesDefault = await readYAML(this.getConfigPath('srRoleGuides', true))
    const zzzRoleGuidesDefault = await readYAML(this.getConfigPath('zzzRoleGuides', true))

    // 处理 default 配置数据
    let srRoleGuidesDefaultData = []
    if (srRoleGuidesDefault && typeof srRoleGuidesDefault === 'object' && Array.isArray(srRoleGuidesDefault.list)) {
      srRoleGuidesDefaultData = srRoleGuidesDefault.list
    } else if (Array.isArray(srRoleGuidesDefault)) {
      srRoleGuidesDefaultData = srRoleGuidesDefault
    }

    let zzzRoleGuidesDefaultData = []
    if (zzzRoleGuidesDefault && typeof zzzRoleGuidesDefault === 'object' && Array.isArray(zzzRoleGuidesDefault.list)) {
      zzzRoleGuidesDefaultData = zzzRoleGuidesDefault.list
    } else if (Array.isArray(zzzRoleGuidesDefault)) {
      zzzRoleGuidesDefaultData = zzzRoleGuidesDefault
    }

    // 确保数据结构正确，与 schemas 的 field 映射一致
    const result = {
      forwardMsg: config.forwardMsg !== undefined ? config.forwardMsg : 1,
      logError: config.logError !== false,
      logLog: config.logLog === true || config.logLog === 1 || config.logLog === 'true',
      logMark: config.logMark !== false,
      logWarn: config.logWarn !== false,
      ossParams: config.ossParams !== undefined ? config.ossParams : '?x-oss-process=image//resize,s_1200/quality,q_90/auto-orient,0/interlace,1/format,jpg',
      help: help || { user: [], master: [] },
      roleGuides: roleGuides || { olds: {}, news: [] },
      srRoleGuides: srRoleGuidesData,
      zzzRoleGuides: zzzRoleGuidesData,
      // 只读视图数据
      roleGuidesDefaultView: (roleGuidesDefault && roleGuidesDefault.news) || [],
      srRoleGuidesDefaultView: srRoleGuidesDefaultData,
      zzzRoleGuidesDefaultView: zzzRoleGuidesDefaultData
    }

    // 添加 all 开关到结果（如果存在）
    if (roleGuides && roleGuides.all !== undefined) {
      result.roleGuides.all = roleGuides.all
    }
    // 星穹铁道和绝区零的配置可能是数组，all 属性可能挂在数组上
    if (srRoleGuides) {
      const srAll = srRoleGuides.all
      if (srAll !== undefined) {
        result.srRoleGuidesAll = srAll
      }
    }
    if (zzzRoleGuides) {
      const zzzAll = zzzRoleGuides.all
      if (zzzAll !== undefined) {
        result.zzzRoleGuidesAll = zzzAll
      }
    }

    logger.log('读取到的配置数据:', JSON.stringify(result, null, 2))
    return result
  }

  // 保存所有配置
  async saveAllConfig(data) {
    const promises = []

    // 将基础配置保存到 config.yaml（包含 forwardMsg、日志配置、OSS参数等）
    const configFields = ['forwardMsg', 'logError', 'logLog', 'logMark', 'logWarn', 'ossParams']
    const hasLogConfig = configFields.some(field => data[field] !== undefined)
    
    if (hasLogConfig) {
      const configToSave = {}
      
      if (data.forwardMsg !== undefined) {
        logger.log(`保存配置: forwardMsg`, data.forwardMsg)
        configToSave.forwardMsg = data.forwardMsg
      }
      
      // 新的日志级别配置
      if (data.logError !== undefined) {
        logger.log(`保存配置: logError`, data.logError)
        configToSave.logError = data.logError
      }
      if (data.logLog !== undefined) {
        logger.log(`保存配置: logLog`, data.logLog)
        configToSave.logLog = data.logLog
      }
      if (data.logMark !== undefined) {
        logger.log(`保存配置: logMark`, data.logMark)
        configToSave.logMark = data.logMark
      }
      if (data.logWarn !== undefined) {
        logger.log(`保存配置: logWarn`, data.logWarn)
        configToSave.logWarn = data.logWarn
      }
      
      // OSS 图片处理参数
      if (data.ossParams !== undefined) {
        logger.log(`保存配置: ossParams`, data.ossParams)
        configToSave.ossParams = data.ossParams
      }
      
      // 兼容旧配置
      if (data.log !== undefined) {
        logger.log(`保存配置: log`, data.log)
        configToSave.log = data.log
      }
      
      // 先读取现有配置
      const existingConfig = await this.getConfig('config')
      
      // 更新logger配置
      const logConfig = {
        error: data.logError !== undefined ? data.logError : existingConfig.logError !== false,
        log: data.logLog !== undefined ? data.logLog : existingConfig.logLog === true,
        mark: data.logMark !== undefined ? data.logMark : existingConfig.logMark !== false,
        warn: data.logWarn !== undefined ? data.logWarn : existingConfig.logWarn !== false
      }
      logger.setLogConfig(logConfig)
      
      // 合并现有配置
      const mergedConfig = { ...existingConfig, ...configToSave }
      promises.push(this.saveConfig('config', mergedConfig))
    }

    if (data.help !== undefined) {
      logger.log(`保存配置: help`, data.help)
      promises.push(this.saveConfig('help', data.help))
    }

    // 修复 roleGuides 的 olds 字段为对象而不是 null
    if (data.roleGuides !== undefined) {
      // 检查 all 开关状态
      const roleGuidesAll = data.roleGuides.all === true || data.roleGuides.all === 1 || data.roleGuides.all === 'true'
      if (roleGuidesAll) {
        // all: true 时，只保存 all 字段，不修改 news/olds
        logger.log(`原神 all=true，只保存 all 开关，不修改 news/olds`)
        const existingConfig = await this.getConfig('roleGuides') || { olds: {}, news: [] }
        const saveData = {
          ...existingConfig,
          all: true
        }
        promises.push(this.saveConfig('roleGuides', saveData))
      } else {
        // all: false 时，正常保存
        // 确保 olds 是对象而不是 null
        if (data.roleGuides.olds === null) {
          data.roleGuides.olds = {}
        }
        // 将 collection_id 从字符串数组转换为数字数组，并根据 sortOrder 排序
        if (Array.isArray(data.roleGuides.news)) {
          data.roleGuides.news = this.sortByOrder(data.roleGuides.news)
          data.roleGuides.news = data.roleGuides.news.map(item => ({
            source: item.source,
            collection_id: this.ensureNumberArray(item.collection_id),
            sortOrder: item.sortOrder
          }))
        }
        logger.log(`保存 roleGuides 配置到 user 目录:`, JSON.stringify(data.roleGuides, null, 2))
        promises.push(this.saveConfig('roleGuides', data.roleGuides))
      }
    }

    // 处理星穹铁道攻略源 all 开关
    if (data.srRoleGuidesAll !== undefined) {
      logger.log(`保存 srRoleGuides all 开关:`, data.srRoleGuidesAll)
      // 读取现有配置并更新 all 字段
      const existingSrConfig = await this.getConfig('srRoleGuides') || { list: [] }
      if (Array.isArray(existingSrConfig)) {
        // 旧格式是数组，转换为新格式
        const newConfig = { all: data.srRoleGuidesAll, list: existingSrConfig }
        promises.push(this.saveConfig('srRoleGuides', newConfig))
      } else {
        // 新格式是对象
        existingSrConfig.all = data.srRoleGuidesAll
        promises.push(this.saveConfig('srRoleGuides', existingSrConfig))
      }
    }

    if (data.srRoleGuides !== undefined && Array.isArray(data.srRoleGuides)) {
      // 检查 all 开关状态 - 优先使用传入的 srRoleGuidesAll，否则读取现有配置
      const srAllValue = data.srRoleGuidesAll !== undefined
        ? data.srRoleGuidesAll
        : (await this.getConfig('srRoleGuides'))?.all
      const srAllEnabled = srAllValue === true || srAllValue === 1 || srAllValue === 'true'

      if (srAllEnabled) {
        // all: true 时，不修改 list
        logger.log(`星铁 all=true，不修改 list`)
      } else {
        // all: false 时，正常保存 list
        // 将 collection_id 从字符串数组转换为数字数组，并根据 sortOrder 排序
        let srList = this.sortByOrder(data.srRoleGuides)
        srList = srList.map(item => ({
          source: item.source,
          collection_id: this.ensureNumberArray(item.collection_id),
          sortOrder: item.sortOrder
        }))
        // 保存为新格式 {all, list}
        const existingSrConfig = await this.getConfig('srRoleGuides') || { list: [] }
        const srData = {
          all: (existingSrConfig && existingSrConfig.all) !== undefined ? existingSrConfig.all : false,
          list: srList
        }
        logger.log(`保存 srRoleGuides 配置到 user 目录:`, JSON.stringify(srData, null, 2))
        promises.push(this.saveConfig('srRoleGuides', srData))
      }
    }

    // 处理绝区零攻略源 all 开关
    if (data.zzzRoleGuidesAll !== undefined) {
      logger.log(`保存 zzzRoleGuides all 开关:`, data.zzzRoleGuidesAll)
      // 读取现有配置并更新 all 字段
      const existingZzzConfig = await this.getConfig('zzzRoleGuides') || { list: [] }
      if (Array.isArray(existingZzzConfig)) {
        // 旧格式是数组，转换为新格式
        const newConfig = { all: data.zzzRoleGuidesAll, list: existingZzzConfig }
        promises.push(this.saveConfig('zzzRoleGuides', newConfig))
      } else {
        // 新格式是对象
        existingZzzConfig.all = data.zzzRoleGuidesAll
        promises.push(this.saveConfig('zzzRoleGuides', existingZzzConfig))
      }
    }

    if (data.zzzRoleGuides !== undefined && Array.isArray(data.zzzRoleGuides)) {
      // 检查 all 开关状态 - 优先使用传入的 zzzRoleGuidesAll，否则读取现有配置
      const zzzAllValue = data.zzzRoleGuidesAll !== undefined
        ? data.zzzRoleGuidesAll
        : (await this.getConfig('zzzRoleGuides'))?.all
      const zzzAllEnabled = zzzAllValue === true || zzzAllValue === 1 || zzzAllValue === 'true'

      if (zzzAllEnabled) {
        // all: true 时，不修改 list
        logger.log(`绝区零 all=true，不修改 list`)
      } else {
        // all: false 时，正常保存 list
        // 将 collection_id 从字符串数组转换为数字数组，并根据 sortOrder 排序
        let zzzList = this.sortByOrder(data.zzzRoleGuides)
        zzzList = zzzList.map(item => ({
          source: item.source,
          collection_id: this.ensureNumberArray(item.collection_id),
          sortOrder: item.sortOrder
        }))
        // 保存为新格式 {all, list}
        const existingZzzConfig = await this.getConfig('zzzRoleGuides') || { list: [] }
        const zzzData = {
          all: (existingZzzConfig && existingZzzConfig.all) !== undefined ? existingZzzConfig.all : false,
          list: zzzList
        }
        logger.log(`保存 zzzRoleGuides 配置到 user 目录:`, JSON.stringify(zzzData, null, 2))
        promises.push(this.saveConfig('zzzRoleGuides', zzzData))
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises)
      logger.log(`配置保存完成，共保存 ${promises.length} 个文件`)
    }
  }

  // 确保数组中的值都是数字
  ensureNumberArray(arr) {
    if (!Array.isArray(arr)) return []
    return arr.map(item => {
      const num = Number(item)
      return isNaN(num) ? item : num
    })
  }

  // 根据 sortOrder 排序攻略源（数字越小优先级越高，未设置sortOrder的排在最后）
  sortByOrder(sources) {
    if (!Array.isArray(sources)) return []

    return sources.sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? Number(a.sortOrder) : Infinity
      const orderB = b.sortOrder !== undefined ? Number(b.sortOrder) : Infinity

      // 如果都未设置sortOrder，保持原顺序
      if (orderA === Infinity && orderB === Infinity) return 0

      // 数字小的排在前面
      return orderA - orderB
    })
  }

  // 加载资源攻略源（来自 LocalStrategyMaterialDownloader）
  async loadResourceSources(game) {
    try {
      const fs = await import('fs')
      const yaml = await import('yaml')

      const file = RESOURCE_FILES[game]
      if (!fs.existsSync(file)) {
        logger.log(`资源文件不存在: ${file}`)
        return []
      }

      const content = fs.readFileSync(file, 'utf8')
      if (!content.trim()) {
        logger.log(`资源文件为空: ${file}`)
        return []
      }

      const data = yaml.parse(content)
      let sources = []
      if (game === 'genshin' && data && typeof data === 'object' && Array.isArray(data.news)) {
        sources = data.news
      } else if (game === 'starrail' && data && typeof data === 'object' && Array.isArray(data.list)) {
        sources = data.list
      } else if (game === 'zzz' && data && typeof data === 'object' && Array.isArray(data.list)) {
        sources = data.list
      } else if (Array.isArray(data)) {
        // 兼容旧格式（直接是数组）
        sources = data
      } else {
        logger.log(`资源文件格式错误: ${file}`)
        return []
      }

      // 过滤无效源：必须有 source 和 collection_id（数组）
      const validSources = sources.filter(s =>
        s && typeof s === 'object' &&
        typeof s.source === 'string' &&
        Array.isArray(s.collection_id)
      )

      logger.log(`加载 ${game} 资源攻略源:`, validSources)
      return validSources
    } catch (error) {
      logger.error(`加载资源攻略源失败:`, error)
      return []
    }
  }
}

// 创建配置管理器实例
const configManager = new ConfigManager()

export { configManager, logger, RESOURCE_FILES }
export default configManager
