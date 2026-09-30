// Series ("types"): each one has its own tone and defaults. {to} / {from} are filled in at render time.
(function () {
  const P = {
    romantic: {
      label: 'Romantic ask', emoji: '💖', blurb: 'Sincere and sweet. A proper "will you be mine?".',
      theme: 'pink', dateMode: 'pick', yesFx: 'grow',
      title: '{to}, will you go out with me?', sub: '— {from}',
      yay: 'YAY!', yaySub: 'Thank you for saying yes. You just made my whole day.',
      dateTitle: 'Pick a day', dateSub: 'Choose the day for our little plan.',
      actTitle: 'What would you like to do?', doneTitle: "It's a date!",
      acts: ['Dinner date', 'Movie night', 'Coffee & walk', 'Picnic', 'Stargazing', 'Surprise me'],
      steps: [
        { t: 'Are you sure? 🥺', e: 'shrink' },
        { t: 'Please think about it again…', e: 'shrink' },
        { t: "You're breaking my heart.", e: 'shake' },
        { t: 'My heart is broken </3', e: 'dodge' }
      ]
    },
    friends: {
      label: 'Hang out', emoji: '🎮', blurb: 'Funny and casual. For your best friend or the whole squad.',
      theme: 'minecraft', dateMode: 'pick', yesFx: 'grow',
      title: '{to}, wanna hang out with me?', sub: 'signed, {from}',
      yay: 'LET\'S GO!', yaySub: 'Knew you couldn\'t resist.',
      dateTitle: 'When are you free?', dateSub: 'Pick a day, no excuses.',
      actTitle: 'What are we doing?', doneTitle: 'Plans made!',
      acts: ['Gaming night', 'Food run', 'Movie marathon', 'Walk & talk', 'Karaoke', 'Chaos, surprise me'],
      steps: [
        { t: 'Bro, really?', e: 'dodge' },
        { t: "I'll bring snacks!", e: 'spin' },
        { t: 'Say yes or I tell everyone.', e: 'shrink' },
        { t: 'There is no "no" here 😌', e: 'dodge' }
      ]
    },
    coffee: {
      label: 'Coffee time', emoji: '☕', blurb: 'Warm and relaxed. One coffee, good talks.',
      theme: 'beach', dateMode: 'pick', yesFx: 'pulse',
      title: '{to}, coffee date? ☕', sub: 'my treat — {from}',
      yay: 'Yay!', yaySub: 'Best decision you made today.',
      dateTitle: 'Pick a day', dateSub: 'Whichever day suits you.',
      actTitle: 'What are you having?', doneTitle: 'Coffee is booked!',
      acts: ['Latte', 'Iced coffee', 'Cappuccino', 'Hot chocolate', 'Tea', 'Surprise me'],
      steps: [
        { t: "It's on me!", e: 'shrink' },
        { t: "I'll even bring pastries.", e: 'shrink' },
        { t: 'Decaf is fine too.', e: 'shake' },
        { t: 'Okay now I need coffee alone…', e: 'dodge' }
      ]
    },
    birthday: {
      label: 'Birthday invite', emoji: '🎂', blurb: 'You set the day. They RSVP and pick what to bring.',
      theme: 'pink', dateMode: 'fixed', yesFx: 'grow',
      title: '{to}, you are invited to my birthday!', sub: '— {from}',
      yay: 'See you there!', yaySub: 'It won\'t be a party without you.',
      dateTitle: 'The big day', dateSub: '',
      actTitle: 'What will you bring?', doneTitle: "You're on the list!",
      acts: ['Cake', 'A gift', 'Drinks', 'Snacks', 'Good vibes only'],
      steps: [
        { t: 'You sure? There is cake 🎂', e: 'shrink' },
        { t: "I'll be sad without you.", e: 'shake' },
        { t: 'Balloons are crying now 🎈', e: 'dodge' }
      ]
    },
    custom: {
      label: 'Something else', emoji: '✨', blurb: 'Start blank and write everything yourself.',
      theme: 'pink', dateMode: 'pick', yesFx: 'grow',
      title: '{to}, will you join me?', sub: '— {from}',
      yay: 'Yay!', yaySub: 'That made me really happy.',
      dateTitle: 'Pick a day', dateSub: 'Choose a day that works.',
      actTitle: 'What should we do?', doneTitle: 'All set!',
      acts: ['Option one', 'Option two', 'Surprise me'],
      steps: [
        { t: 'Are you sure?', e: 'shrink' },
        { t: 'Really?', e: 'dodge' }
      ]
    }
  };
  window.PRESETS = P;
  window.PRESET_ORDER = ['romantic', 'friends', 'coffee', 'birthday', 'custom'];
  window.RELATIONS = [
    ['girlfriend', 'My girlfriend', ['romantic', 'coffee', 'birthday', 'custom']],
    ['boyfriend', 'My boyfriend', ['romantic', 'coffee', 'birthday', 'custom']],
    ['partner', 'My partner', ['romantic', 'coffee', 'birthday', 'custom']],
    ['friend', 'A friend', ['friends', 'coffee', 'birthday', 'custom']],
    ['bestie', 'My bestie', ['friends', 'coffee', 'birthday', 'romantic', 'custom']]
  ];
})();
