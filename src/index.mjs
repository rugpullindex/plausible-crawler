// @format
import dotenv from "dotenv";
dotenv.config();
import fetch from "cross-fetch";
import { add, parse, format } from "date-fns";
import { env } from "process";
import { unlink, appendFile } from "fs/promises";
import { EOL } from "os";

const { APIKEY } = env;

const siteId = "rugpullindex.com";
const startDate = "2021-04-26";
const endDate = "2021-04-27";
const period = "day";
const rule = "yyyy-MM-dd";
const fileName = "dailyvisitors.csv";
const filters = "event:name==Outbound Link: Click";
const property = "event:props:url";

async function get(date) {
  const url = `https://plausible.io/api/v1/stats/breakdown?site_id=${siteId}&property=${property}&period=${period}&date=${date}&filters=${filters}`;
  const reply = await fetch(encodeURI(url), {
    headers: {
      Authorization: `Bearer ${APIKEY}`
    }
  });

  return await reply.json();
}

function increment(date) {
  const pDate = parse(date, rule, new Date());
  return format(add(pDate, { days: 1 }), rule);
}

async function init() {
  const requests = [];

  let pointer = startDate;
  while (pointer !== endDate) {
    requests.push(await get(pointer));
    pointer = increment(pointer);
  }

  return requests;
}

async function unpack(requests) {
  let data = [];
  for (let result of await Promise.allSettled(requests)) {
    if (result.status === "fulfilled") {
      if (result.value.error) {
        throw new Error(result.value.error);
      }
      data = [...data, ...result.value.results];
    } else {
      throw new Error("Failed to retrieve data at one point");
    }
  }

  return data;
}

async function write(data) {
  for (let { date, visitors } of data) {
    await appendFile(fileName, `${date};${visitors}${EOL}`);
  }
}

async function run() {
  try {
    await unlink(fileName);
  } catch (err) {
    //noop
  }
  const requests = await init();
  const data = await unpack(requests);
  await write(data);
}

run().then();
