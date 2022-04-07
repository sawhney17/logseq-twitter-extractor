import "@logseq/libs";
import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin.user";
import axios from "axios";
import 'logseq-dateutils'
import { getDateForPage, getDateForPageWithoutBrackets } from "logseq-dateutils";


var userConfigs;
logseq.App.getUserConfigs().then((result) => { userConfigs = result })
let BEARERTOKEN = process.env.BEARERTOKEN
let baseURL = "https://api.twitter.com/2/tweets/";

let tweetRegex = /https:\/\/twitter.com.\S*/g

let settings: SettingSchemaDesc[] = [{
  key: "InsertionTemplateForBlock1",
  type: "string",
  title: "Insertion template for block 1",
  description: "Enter your desired template for the parent block, created by default for every return value of the query. Options are URL, Name, Username, Date, and Tweet",
  default: "{TWEET} {Date}, [[{Name}]]"
},
{
  key: "InsertionTemplateForBlock2",
  type: "string",
  title: "Insertion template for block 2",
  description: "Enter your desired template for the child block, created by default only if template is present, for every return value of the query. Options are URL, Name, Username, Date, and Tweet",
  default: ""
},
{ //add option for keyboard shortcut
  key: "KeyboardShortcut",
  type: "string",
  title: "Keyboard Shortcut",
  description: "Enter your desired keyboard shortcut for the command",
  default: "mod+shift+t"
}
]

function formatDate(dateText) {
  var dateObject = new Date(dateText)
  const date = getDateForPageWithoutBrackets(dateObject, userConfigs.preferredDateFormat)
  return date
}
logseq.useSettingsSchema(settings);

function templateBlocks(data, template, url) {
  var finalString = template
  console.log(data)
  let replacements = {
    "URL": url,
    "Date": formatDate(data.data[0].created_at),
    "Tweet": data.data[0].text,
    "Name": data["includes"]["users"][0]["name"],
    "Username": data["includes"]["users"][0]["username"],
  }
  for (let key in replacements) {
    let regexString = new RegExp(`{${key}}`, "gi")
    finalString = finalString.replaceAll(regexString, replacements[key])
  }
  return finalString
}
async function parseTweet(id, uuid, url) {
  axios.get(`https://api.twitter.com/2/tweets?ids=${id}&tweet.fields=created_at&expansions=author_id&user.fields=created_at`, {
    'headers': {
      "Authorization": `Bearer ${BEARERTOKEN}`
    }
  }).then((result) => {
    logseq.Editor.updateBlock(uuid, templateBlocks(result.data, logseq.settings.InsertionTemplateForBlock1, url))
    if (logseq.settings.InsertionTemplateForBlock2 != "") {
      logseq.Editor.insertBlock(uuid, templateBlocks(result.data, logseq.settings.InsertionTemplateForBlock2, url), { sibling: false })
    }
  })
}
async function detectURL(e) {
  try {
    let url = (await logseq.Editor.getBlock(e.uuid)).content.match(tweetRegex)
    let id = url[0].split("/")[5].split("?")[0]
    parseTweet(id, e.uuid, url)
  }
  catch {
    logseq.App.showMsg(
      "No URL detected",
    )
  }
}

const main = async () => {
  userConfigs = await logseq.App.getUserConfigs()
  console.log("plugin loaded");
  logseq.Editor.registerSlashCommand("Parse Twitter URL", async (e) => {
    detectURL(e);
  });
  logseq.App.registerCommandPalette({
    key: "ParseTwitter",
    label: "Parse Twitter URL(s)",
    keybinding: {
      mode: "global",
      binding: "mod+shift+t"
    },
  }, (e) => {
    if (e.uuid != null) {
      detectURL(e);
    }
    else {
      logseq.Editor.getSelectedBlocks().then((blocks) => {
        for (const x in blocks){
          detectURL(blocks[x])
        }
      }
      )
    }
  })
};

logseq.ready(main).catch(console.error);
