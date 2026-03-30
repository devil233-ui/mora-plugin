import lodash from 'lodash'
import path from 'path'
import { fileURLToPath } from 'url'
import { configManager, logger } from './model/setting.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function supportGuoba() {
  return {
    pluginInfo: { 
      name: 'mora-plugin',
      title: '摩拉插件',
      author: '@Rrrrrrray',
      authorLink: 'https://gitee.com/Rrrrrrray',
      link: 'https://gitee.com/Rrrrrrray/mora-plugin',
      isV3: true,
      isV2: true,
      description: '【此版本为fork】提供角色攻略、配队、卡池等信息的摩拉插件',
      // 使用图标路径而不是图标名称
      iconPath: `${__dirname}/resources/img/icons/logo.png`
    },
    configInfo: {
      schemas: [
        {
          component: 'SOFT_GROUP_BEGIN',
          label: '基础配置'
        },
        {
          field: 'forwardMsg',
          label: '合并转发模式',
          bottomHelpMessage: '是否开启合并转发，默认开启，0为拼接消息模式',
          component: 'Select',
          componentProps: {
            options: [
              { label: '开启合并转发', value: 1 },
              { label: '关闭合并转发(拼接消息)', value: 0 }
            ]
          }
        },
        {
          field: 'logError',
          label: 'Error日志开关',
          bottomHelpMessage: 'false = 关闭（不显示 logger.error 日志），true = 开启（显示 logger.error 日志）',
          component: 'Switch'
        },
        {
          field: 'logLog',
          label: 'Log日志开关',
          bottomHelpMessage: 'false = 关闭（不显示 logger.log 日志），true = 开启（显示 logger.log 日志）',
          component: 'Switch'
        },
        {
          field: 'logMark',
          label: 'Mark日志开关',
          bottomHelpMessage: 'false = 关闭（不显示 logger.mark 日志），true = 开启（显示 logger.mark 日志）',
          component: 'Switch'
        },
        {
          field: 'logWarn',
          label: 'Warn日志开关',
          bottomHelpMessage: 'false = 关闭（不显示 logger.warn 日志），true = 开启（显示 logger.warn 日志）',
          component: 'Switch'
        },
        {
          field: 'ossParams',
          label: 'OSS图片处理参数',
          bottomHelpMessage: '【请询问ai解析修改】阿里云OSS图片处理参数，用于优化图片加载速度和质量',
          component: 'Input'
        },
        {
          component: 'SOFT_GROUP_BEGIN',
          label: '帮助指令配置'
        },
        {
          field: 'help.user',
          label: '用户指令',
          bottomHelpMessage: '配置用户可见的指令列表（拖拽可排序）',
          component: 'GSubForm',
          componentProps: {
            multiple: true,
            draggable: true,
            schemas: [
              {
                field: 'name',
                label: '指令名称',
                component: 'Input',
                bottomHelpMessage: '指令触发词，如：#艾尔海森攻略'
              },
              {
                field: 'des',
                label: '指令描述',
                component: 'Input',
                bottomHelpMessage: '指令功能描述'
              },
              {
                field: 'icon',
                label: '图标',
                component: 'Select',
                bottomHelpMessage: '指令图标',
                componentProps: {
                  options: [
                    { label: '派蒙', value: 'paimon' },
                    { label: '队伍', value: 'team' },
                    { label: '卡池', value: 'emerald' },
                    { label: '魈', value: 'xiao' },
                    { label: '恐龙', value: 'dinosaur' },
                    { label: '虚空', value: 'akasha' }
                  ]
                }
              }
            ]
          }
        },
        {
          field: 'help.master',
          label: '管理员指令',
          bottomHelpMessage: '配置管理员指令列表（拖拽可排序）',
          component: 'GSubForm',
          componentProps: {
            multiple: true,
            draggable: true,
            schemas: [
              {
                field: 'name',
                label: '指令名称',
                component: 'Input',
                bottomHelpMessage: '管理员指令触发词'
              },
              {
                field: 'des',
                label: '指令描述',
                component: 'Input',
                bottomHelpMessage: '指令功能描述'
              },
              {
                field: 'icon',
                label: '图标',
                component: 'Select',
                bottomHelpMessage: '指令图标',
                componentProps: {
                  options: [
                    { label: 'Monkas', value: 'monkas' },
                    { label: '队伍', value: 'team' },
                    { label: '更新', value: 'update' }
                  ]
                }
              }
            ]
          }
        },
        {
          component: 'SOFT_GROUP_BEGIN',
          label: '原神角色攻略配置'
        },
        {
          field: 'roleGuides.all',
          label: '使用默认攻略源',
          bottomHelpMessage: '开启时读取 config/default/roleGuides.yaml，关闭时读取 config/user/roleGuides.yaml',
          component: 'Switch'
        },
        {
          field: 'roleGuides.news',
          label: '攻略数据源（自定义）',
          bottomHelpMessage: '配置原神角色攻略的数据源（通过"排序序号"调整）',
          component: 'GSubForm',
          vIf: '!$config.roleGuides.all',
          componentProps: {
            multiple: true,
            draggable: true,
            schemas: [
              {
                field: 'sortOrder',
                label: '排序序号',
                component: 'InputNumber',
                bottomHelpMessage: '输入数字调整排序（1为最高优先级），保存后自动按此排序',
                componentProps: {
                  min: 1,
                  placeholder: '序号'
                }
              },
              {
                field: 'source',
                label: '攻略作者',
                component: 'Input',
                bottomHelpMessage: '攻略作者名称，如：HoYo青枫',
                componentProps: {
                  placeholder: '请输入攻略作者名称'
                }
              },
              {
                field: 'collection_id',
                label: '合集ID',
                bottomHelpMessage: '米游社合集ID列表（按回车添加多个）',
                component: 'GTags',
                componentProps: {
                  placeholder: '请输入合集ID（数字）',
                  allowAdd: true,
                  allowDel: true,
                  valueParser: 'Number'
                }
              }
            ]
          }
        },
        {
          field: 'roleGuidesDefaultView',
          label: '攻略数据源（默认）',
          bottomHelpMessage: '当前使用默认攻略源，如需自定义请关闭上方开关（当前栏只读）',
          component: 'GSubForm',
          vIf: '$config.roleGuides.all',
          componentProps: {
            multiple: true,
            draggable: false,
            disabled: true,
            schemas: [
              {
                field: 'sortOrder',
                label: '排序序号',
                component: 'InputNumber',
                componentProps: {
                  min: 1,
                  placeholder: '序号',
                  disabled: true
                }
              },
              {
                field: 'source',
                label: '攻略作者',
                component: 'Input',
                componentProps: {
                  placeholder: '攻略作者名称',
                  disabled: true
                }
              },
              {
                field: 'collection_id',
                label: '合集ID',
                component: 'GTags',
                componentProps: {
                  placeholder: '合集ID列表',
                  disabled: true
                }
              }
            ]
          }
        },
        {
          component: 'SOFT_GROUP_BEGIN',
          label: '星穹铁道角色攻略配置'
        },
        {
          field: 'srRoleGuidesAll',
          label: '使用默认攻略源',
          bottomHelpMessage: '开启时读取 config/default/srRoleGuides.yaml，关闭时读取 config/user/srRoleGuides.yaml',
          component: 'Switch'
        },
        {
          field: 'srRoleGuides',
          label: '攻略数据源（自定义）',
          bottomHelpMessage: '配置星穹铁道角色攻略的数据源（通过"排序序号"调整）',
          component: 'GSubForm',
          vIf: '!$config.srRoleGuidesAll',
          componentProps: {
            multiple: true,
            draggable: true,
            schemas: [
              {
                field: 'sortOrder',
                label: '排序序号',
                component: 'InputNumber',
                bottomHelpMessage: '输入数字调整排序（1为最高优先级），保存后自动按此排序',
                componentProps: {
                  min: 1,
                  placeholder: '序号'
                }
              },
              {
                field: 'source',
                label: '攻略作者',
                component: 'Input',
                bottomHelpMessage: '攻略作者名称',
                componentProps: {
                  placeholder: '请输入攻略作者名称'
                }
              },
              {
                field: 'collection_id',
                label: '合集ID',
                bottomHelpMessage: '米游社合集ID列表（按回车添加多个）',
                component: 'GTags',
                componentProps: {
                  placeholder: '请输入合集ID（数字）',
                  allowAdd: true,
                  allowDel: true,
                  valueParser: 'Number'
                }
              }
            ]
          }
        },
        {
          field: 'srRoleGuidesDefaultView',
          label: '攻略数据源（默认）',
          bottomHelpMessage: '当前使用默认攻略源，如需自定义请关闭上方开关（当前栏只读）',
          component: 'GSubForm',
          vIf: '$config.srRoleGuidesAll',
          componentProps: {
            multiple: true,
            draggable: false,
            disabled: true,
            schemas: [
              {
                field: 'sortOrder',
                label: '排序序号',
                component: 'InputNumber',
                componentProps: {
                  min: 1,
                  placeholder: '序号',
                  disabled: true
                }
              },
              {
                field: 'source',
                label: '攻略作者',
                component: 'Input',
                componentProps: {
                  placeholder: '攻略作者名称',
                  disabled: true
                }
              },
              {
                field: 'collection_id',
                label: '合集ID',
                component: 'GTags',
                componentProps: {
                  placeholder: '合集ID列表',
                  disabled: true
                }
              }
            ]
          }
        },
        {
          component: 'SOFT_GROUP_BEGIN',
          label: '绝区零角色攻略配置'
        },
        {
          field: 'zzzRoleGuidesAll',
          label: '使用默认攻略源',
          bottomHelpMessage: '开启时读取 config/default/zzzRoleGuides.yaml，关闭时读取 config/user/zzzRoleGuides.yaml',
          component: 'Switch'
        },
        {
          field: 'zzzRoleGuides',
          label: '攻略数据源（自定义）',
          bottomHelpMessage: '配置绝区零角色攻略的数据源（通过"排序序号"调整）',
          component: 'GSubForm',
          vIf: '!$config.zzzRoleGuidesAll',
          componentProps: {
            multiple: true,
            draggable: true,
            schemas: [
              {
                field: 'sortOrder',
                label: '排序序号',
                component: 'InputNumber',
                bottomHelpMessage: '输入数字调整排序（1为最高优先级），保存后自动按此排序',
                componentProps: {
                  min: 1,
                  placeholder: '序号'
                }
              },
              {
                field: 'source',
                label: '攻略作者',
                component: 'Input',
                bottomHelpMessage: '攻略作者名称',
                componentProps: {
                  placeholder: '请输入攻略作者名称'
                }
              },
              {
                field: 'collection_id',
                label: '合集ID',
                bottomHelpMessage: '米游社合集ID列表（按回车添加多个）',
                component: 'GTags',
                componentProps: {
                  placeholder: '请输入合集ID（数字）',
                  allowAdd: true,
                  allowDel: true,
                  valueParser: 'Number'
                }
              }
            ]
          }
        },
        {
          field: 'zzzRoleGuidesDefaultView',
          label: '攻略数据源（默认）',
          bottomHelpMessage: '当前使用默认攻略源，如需自定义请关闭上方开关（当前栏只读）',
          component: 'GSubForm',
          vIf: '$config.zzzRoleGuidesAll',
          componentProps: {
            multiple: true,
            draggable: false,
            disabled: true,
            schemas: [
              {
                field: 'sortOrder',
                label: '排序序号',
                component: 'InputNumber',
                componentProps: {
                  min: 1,
                  placeholder: '序号',
                  disabled: true
                }
              },
              {
                field: 'source',
                label: '攻略作者',
                component: 'Input',
                componentProps: {
                  placeholder: '攻略作者名称',
                  disabled: true
                }
              },
              {
                field: 'collection_id',
                label: '合集ID',
                component: 'GTags',
                componentProps: {
                  placeholder: '合集ID列表',
                  disabled: true
                }
              }
            ]
          }
        }
      ],
      // 获取配置数据方法（用于前端填充显示数据）
      async getConfigData() {
        try {
          // 初始化log配置
          await configManager.getLogConfig()

          logger.log('开始读取配置...')
          const config = await configManager.getAllConfig()
          logger.log('配置读取成功:', JSON.stringify(config, null, 2))
          return config
        } catch (error) {
          logger.error('获取配置失败', error)
          return {
            config: {},
            help: { user: [], master: [] },
            roleGuides: { olds: {}, news: [] },
            srRoleGuides: [],
            zzzRoleGuides: [],
            logError: true,
            logLog: false,
            logMark: true,
            logWarn: true
          }
        }
      },
      // 设置配置的方法（前端点确定后调用的方法）
      async setConfigData(data, { Result }) {
        try {
          logger.log('接收到原始配置数据:', JSON.stringify(data, null, 2))
          
          // 使用 lodash 处理嵌套配置路径（如 'roleGuides.news'）
          let processedData = {}
          for (let [keyPath, value] of Object.entries(data)) {
            lodash.set(processedData, keyPath, value)
          }
          
          logger.log('处理后的配置数据:', JSON.stringify(processedData, null, 2))
          await configManager.saveAllConfig(processedData)
          logger.log('配置保存成功')
          return Result.ok({}, '保存成功~ Ciallo～(∠・ω )⌒☆~')
        } catch (error) {
          logger.error('保存配置失败', error)
          return Result.error(`保存失败: ${error.message}`)
        }
      }
    }
  }
}

export { configManager, logger }
export default configManager
