const puppeteer = require('puppeteer');
const fs = require('fs');

const paths = [
  'https://www.facebook.com/Bushido/',
  'https://www.facebook.com/mesutoezil/',
  'https://www.facebook.com/joko.winterscheidt.14/',
  'https://www.facebook.com/LukasPodolski/',
];

const startDate = '2018-03-01';
const endDate = '2018-05-31';

async function scrollToDate(page, date) {
  let oldest
  do {
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page.waitFor(1000);

    oldest = await page.evaluate(() => {
      let posts = document.querySelectorAll('.userContentWrapper');
      posts = Object.values(posts)
      let date = posts[posts.length - 1].querySelector('.timestampContent').innerText
      return date
    })

    if (!/,\s\d{4}/g.test(oldest)) {
      oldest = `${oldest}, ${new Date().getFullYear()}`;
    }
    console.log(new Date(oldest).toDateString())
  } while (isNaN(Date.parse(oldest)) || new Date(oldest) >= new Date(date))
}

(async () => {
  const browser = await puppeteer.launch({
    // headless: false,
    // slowMo: 100,
    args: ['--lang=en-US'],
    userDataDir: '/tmp/profile'
  });

  const profiles = await Promise.all(paths.map(async (path) => {

    const page = await browser.newPage();
    page.setViewport({width: 1280, height: 926});
    await page.goto(`${path}posts`);
    await page.waitFor(1000);


    try {
      await scrollToDate(page, `${startDate}T00:00:00`);
    } catch (error) {
      console.log(error)
      return {
        path,
        posts: [{
          date: 'Error',
          post: error.message,
        }],
      }
    }
    console.log('Done scrolling');
    let res

    try {
      res = await page.evaluate(() => {
        let posts = document.querySelectorAll('.userContentWrapper')
        posts = Object.values(posts)

        console.log(posts)
        return posts.reduce((posts, post) => {
          let paragraphs = post.querySelectorAll('p');
          paragraphs = Object.values(paragraphs)
          if (paragraphs.length) {
            let paragraph = paragraphs.map(p => p.innerText).reduce((res, p) => `${res} ${p}`)

            const p = {
              post: paragraph,
              date: post.querySelector('.timestampContent').innerText,
            }
            posts.push(p)
          }

          return posts
        }, [])
      })
      console.log('Posts found')
    } catch (error) {
      console.log(error.message)
      return {
        path,
        posts: [{
          date: 'Error',
          post: error.message,
        }],
      }
    }

    res = res.reduce((posts, post) => {
      let date = post.date
      if (!/,\s\d{4}/g.test(date)) {
        date = `${date}, ${new Date().getFullYear()}`;
      }
      date = date.replace(/\sat\s\d{2}:\d{2}(pm|am)/g, '')

      if (new Date(date) >= new Date(`${startDate}T00:00:00`) && new Date(date) <= new Date(`${endDate}T23:59:59`)) {
        posts.push({
          post: post.post,
          date,
        })
      }
      return posts
    }, [])

    return {
      path,
      posts: res,
    }
  }))


  const stream = fs.createWriteStream('./posts.txt')
  profiles.forEach(profile => {
    stream.write(`${profile.path}\n`)
    profile.posts.forEach(post => {
      post.post = post.post.replace(/\n/g, ' ');
      stream.write(`${post.date}{${post.post}\n`)
    })
    stream.write('\n')
  })

  await browser.close();
})();

