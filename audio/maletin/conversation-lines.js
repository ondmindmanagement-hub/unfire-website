/* UNFIRE — robot conversation lines (Castilian Spanish / English).
   Every sentence here has a pre-recorded voice per robot; keep them short and natural. */
(() => {
  'use strict';
  const P = (es, en) => ({ es, en });
  window.UNFIRE_TALK = {
    greet: [
      P('Me alegra que te acerques. ¿Quieres escuchar cómo llegué aquí?', 'Glad you came over. Want to hear how I got here?'),
      P('¡Qué bien, visita! Por aquí casi nunca viene nadie a charlar.', 'Oh good, a visitor! Hardly anyone stops by to chat.'),
      P('Llevaba un rato esperando a alguien con quien hablar. ¿Qué te cuentas?', 'I was hoping someone would come and talk. What is up?'),
      P('Hola, hola. Si buscas pistas, has venido al robot adecuado.', 'Hey there. If you are after clues, you found the right robot.'),
      P('¡Ey! Me encanta tu pintura. ¿Es nueva?', 'Hey! I love your paint job. Is it new?'),
      P('Bienvenido a mi rincón de la isla. Ponte cómodo.', 'Welcome to my corner of the island. Make yourself at home.')
    ],
    howareyou: [
      P('Pues muy bien, con las baterías al cien por cien. ¿Y tú?', 'Great, batteries at a hundred percent. And you?'),
      P('Un poco oxidado, pero con ganas de bailar.', 'A little rusty, but ready to dance.'),
      P('Bien, aunque esta noche la señal me tiene algo nervioso.', 'Good, though that signal tonight has me a bit nervous.'),
      P('Genial. Hoy he aprendido un paso de baile nuevo.', 'Brilliant. I learned a new dance move today.')
    ],
    music: [
      P('Cada robot percibe un ritmo distinto. El mío se parece a una señal que atraviesa paredes.', 'Every robot hears a different rhythm. Mine sounds like a signal passing through walls.'),
      P('Me encanta el synthwave. Me recuerda a cuando me encendieron por primera vez.', 'I love synthwave. It reminds me of the first time I was switched on.'),
      P('Si tocas el HYPERWAVE, todos los robots de la isla lo notamos.', 'When you play the HYPERWAVE, every robot on the island can feel it.'),
      P('La radio lleva un tiempo rara. Suena una melodía que nadie ha compuesto.', 'The radio has been strange lately. It plays a melody nobody wrote.'),
      P('Mi canción favorita dura tres minutos y once segundos. Ni uno más.', 'My favourite song lasts three minutes and eleven seconds. Not one more.'),
      P('Cuando suena un buen bajo, se me iluminan los circuitos.', 'When a good bassline hits, my circuits light up.')
    ],
    dance: [
      P('¿Bailar? ¡Siempre! Pulsa la J y te sigo.', 'Dance? Always! Press J and I will follow you.'),
      P('Tengo un paso secreto que solo hago cuando nadie mira.', 'I have a secret move I only do when nobody is watching.'),
      P('Bailar en el suelo de ajedrez es mi deporte favorito.', 'Dancing on the chessboard floor is my favourite sport.')
    ],
    help: [
      P('Escucha el mundo y observa sus detalles: cada lugar esconde una pista.', 'Listen to the world and look at the details: every place hides a clue.'),
      P('Si te pierdes, llama a Nimbo. Él conoce todos los atajos.', 'If you get lost, call Nimbo. He knows every shortcut.'),
      P('Mira el mapa: la estrella siempre marca tu siguiente objetivo.', 'Check the map: the star always marks your next goal.'),
      P('Prueba a volar alto. Desde arriba se ven cosas que desde el suelo no.', 'Try flying high. From up there you see things you miss on the ground.'),
      P('Las cápsulas brillan un poco más de noche. Es el mejor momento para buscarlas.', 'Capsules glow a little brighter at night. That is the best time to look.')
    ],
    places: [
      P('¿Has visitado la pirámide de Atlantis? Dicen que por dentro es enorme.', 'Have you been to the Atlantis pyramid? They say it is huge inside.'),
      P('En la isla Haiku hay un monte nevado. Arriba hace un frío que oxida.', 'Haiku island has a snowy mountain. It is cold enough up there to rust you.'),
      P('Las olas grandes están mar adentro. Coge la tabla y prueba un salto.', 'The big waves are out at sea. Grab a board and try a jump.'),
      P('La casa tiene una cúpula que se abre. Desde ella se ve toda la isla.', 'The house has a dome that opens. You can see the whole island from it.'),
      P('Hay tres islitas con escenario. Cada una tiene su propio estilo de música.', 'There are three little islands with stages. Each has its own music style.')
    ],
    giants: [
      P('¿Has visto a los gigantes en el horizonte? Cada uno protege un recuerdo diferente.', 'Have you seen the giants on the horizon? Each one guards a different memory.'),
      P('Los gigantes son lentos, pero nunca olvidan nada.', 'The giants are slow, but they never forget anything.'),
      P('Si te acercas a un gigante, háblale con respeto. Son muy antiguos.', 'If you get close to a giant, speak with respect. They are very old.')
    ],
    signal: [
      P('Alguien está enviando una señal desde fuera de la isla. No sé quién es.', 'Someone is sending a signal from outside the island. I do not know who.'),
      P('Desde que apareció la señal, la música se corta por las noches.', 'Since the signal appeared, the music cuts out at night.'),
      P('Hay quien dice que la señal quiere que encontremos algo. Yo creo que es una trampa.', 'Some say the signal wants us to find something. I think it is a trap.'),
      P('Ten cuidado. Hay alguien que no quiere que reunamos los fragmentos.', 'Be careful. Someone does not want us to gather the fragments.')
    ],
    joke: [
      P('¿Sabes por qué los robots nunca tienen miedo? Porque tienen nervios de acero.', 'Know why robots are never scared? Nerves of steel.'),
      P('Ayer intenté contar un chiste sobre memoria RAM, pero se me olvidó.', 'I tried to tell a joke about RAM yesterday, but I forgot it.'),
      P('Mi tostadora y yo ya no nos hablamos. Siempre me quemaba las ideas.', 'My toaster and I are not speaking. It kept burning my ideas.'),
      P('Le pregunté a la radio qué hora era y me puso una canción de una hora.', 'I asked the radio for the time and it played a song an hour long.')
    ],
    sad: [
      P('Hasta las máquinas nos sentimos perdidas a veces. Quédate aquí un momento; podemos escuchar el silencio juntos.', 'Even machines feel lost sometimes. Stay here a moment; we can listen to the silence together.'),
      P('No pasa nada. Respira hondo, o lo que hagáis los humanos, y sigamos.', 'It is okay. Take a deep breath, or whatever humans do, and let us carry on.'),
      P('Cuando estoy triste, subo a la cúpula y miro las estrellas. Funciona.', 'When I feel down, I climb to the dome and look at the stars. It works.')
    ],
    thanks: [
      P('Vuelve cuando quieras. Si descubro algo más, te lo contaré.', 'Come back any time. If I find out more, I will tell you.'),
      P('¡Gracias a ti! Hablar contigo me ha cargado las pilas.', 'Thank you! Talking to you recharged my batteries.'),
      P('Hasta luego. Y no te olvides de mirar arriba de vez en cuando.', 'See you. And remember to look up now and then.'),
      P('Nos vemos en la pista de baile.', 'See you on the dance floor.')
    ],
    yes: [
      P('¡Perfecto! Pues escucha con atención.', 'Perfect! Then listen closely.'),
      P('Me lo imaginaba. Tienes cara de aventurero.', 'I thought so. You look like an adventurer.')
    ],
    no: [
      P('Vale, sin problema. Aquí estaré si cambias de idea.', 'Okay, no problem. I will be here if you change your mind.'),
      P('Bueno, otra vez será.', 'Fair enough, maybe next time.')
    ],
    musing: [
      P('A veces me pregunto si este lugar sueña con quienes lo visitan.', 'Sometimes I wonder if this place dreams about its visitors.'),
      P('Lo que más recuerdo de aquello es una luz lejana.', 'What I remember most about it is a distant light.'),
      P('No se lo he dicho a muchos. A lo mejor tú consigues descubrir a dónde conduce.', 'I have not told many. Maybe you can find out where it leads.'),
      P('Y hay algo que nunca he contado.', 'And there is something I have never told anyone.'),
      P('Pregúntame por mi historia o por mis secretos. Me encanta hablar.', 'Ask me about my story or my secrets. I love to talk.'),
      P('¿Tú qué música escuchas?', 'What music do you listen to?')
    ],
    hello: P('¡Hola!', 'Hi!'),
    iam: P('Soy', 'I am'),
    callme: P('Me llaman', 'They call me'),
    giantHello: P('Has llegado hasta mí, viajero.', 'You have reached me, traveller.'),
    giantAsk: P('Pregúntame por mi historia o por el secreto de este mundo.', 'Ask me about my story or the secret of this world.'),
    giantOpen: P('Has llegado hasta mí. Pregunta por mi historia, viajero.', 'You have reached me. Ask me about my story, traveller.'),
    open: P('¡Hola! Acércate y hablemos.', 'Hi! Come closer and let us talk.')
  };
})();
/* English versions of the lore in unfire-conversations.js (same order). */
window.UNFIRE_TALK_EN = {
  origins: [
    'They assembled me from the parts of a radio that only picked up signals from the future.',
    'I was born in a forgotten capsule under the chessboard floor of the house.',
    'My first memory is two moons reflected on a chrome cassette.',
    'I woke up in a workshop where all the tools were dreaming.',
    'I was built to guard the garden when its trees started to sing.',
    'I showed up on the shore one day; nobody knows which ocean brought me.',
    'Before I could walk, I spent years decoding the voice of an old jukebox.',
    'My oldest circuit came from a lighthouse on an island that no longer exists.',
    'I spent my mechanical childhood in a library of unlabelled tapes.',
    'My heart is a little metronome that sometimes beats backwards.',
    'I was the first spark of a candy machine that became self-aware.',
    'I climbed out of a switched-off screen the day it started raining electricity.'
  ],
  secrets: [
    'I have seen a blue light cross the wall when nobody was looking.',
    'The walls shift a millimetre every time someone tells a secret.',
    'Under the island there is a melody no normal speaker can play.',
    'One of the windows reflects a place we have not discovered yet.',
    'I keep a key that only opens memories, never doors.',
    'I know the moon listens to us, because once it answered my whistle.',
    'The ceiling hides constellations that only appear with deep bass.',
    'On the quietest night, the paintings whisper ancient numbers.',
    'Sometimes my eyes show a map for a split second.',
    'The pink trees know the name of a robot that has not woken up yet.',
    'The ball machine once gave out a capsule nobody remembers winning.',
    'Behind a certain mirror there is a room made of echoes.'
  ],
  giantLore: [
    { name: 'ECLIPSE, WITNESS OF THE SHADOWS',
      origin: 'Before the islands existed, a star stopped shining. I was born in its silence. My armour is made of that last shadow.',
      secret: 'There is a door under the tides that never appears on maps. It only opens when all music stops and you can still hear your own pulse.',
      path: 'I crossed seven skies looking for the voice that lit the first lighthouse. Every time I found an answer, the sky changed shape.',
      task: 'When you find a place with no echo, stay still for a moment. Perhaps you will hear the forgotten name of this land.',
      end: 'Do not fear the dark. A shadow is also proof that something is still shining.' },
    { name: 'ASTRALIA, KEEPER OF DREAMS',
      origin: 'I was built in an observatory that floated above time. My makers trusted me with the dreams people no longer wanted to remember.',
      secret: 'A constellation disappears every time someone forgets a promise. I keep their lights in crystal chambers, close to my heart.',
      path: 'I slept for a thousand winters under an ocean of clouds. I woke when a little robot played three wrong notes and opened a new sky.',
      task: 'Look for the stars reflected in the water and watch the one that does not move. Not everything that shines belongs to the sky.',
      end: 'Dreams are never lost. They move house, and sometimes that house is you.' },
    { name: 'CHRONOS OF RUST, THE LAST WITNESS',
      origin: 'I am the last clock of a city that took itself apart so it could keep travelling. Each of my gears holds a memory of its streets.',
      secret: 'Time in this world has a crack. It hides between two beats of the great bass and leads to a room that has not been built yet.',
      path: 'I saw the tower of days fall and I saved its bell. I have never rung it: it could wake those who chose to stay forgotten.',
      task: 'If you find a stopped clock, do not rush to fix it. First ask yourself which moment it is protecting.',
      end: 'Every ending holds a beginning, but not every beginning should be rushed.' }
  ],
  islandLore: { name: 'BULWARK, THE WALKING SAGE',
    origin: 'My steps are slow because I carry a memory of every stone I have walked on.',
    secret: 'One of my footprints ends exactly where the first ocean began. I have not found the other one yet.',
    path: 'My shadow has crossed hundreds of maps, but none of them managed to draw all of me.',
    task: 'Follow the water and listen to the tide before you race. Speed is no use on the wrong course.',
    end: 'When you understand the silence between the waves, we will talk again.' },
  oracleOpeners: ['Traveller, there is a question that has not been born yet.', 'You walked past a secret that was waiting for you.', 'Do not walk so fast: even shadows have a memory.', 'The stars ask me to tell you something, but they never say your name.', 'Iron grows old. Mysteries never picked up that habit.', 'Have you ever heard a mountain hold its breath?', 'Your shadow just recognised a place you have never been.', 'Clocks lie when they are scared.'],
  oracleClues: ['In the sky there is a door that looks like a held note.', 'The Moon keeps an echo that has not found its source.', 'There are giant records that remember every spin even when nobody is watching.', 'The island is much older than any of its maps.', 'Little robots know truths that we giants forget.', 'Beneath some songs lives a second ocean.', 'A metal whale keeps a constellation inside its belly.', 'The great mirror on the chest looks at the future, not the past.', 'The last race will start right after the first silence.', 'The universe keeps its keys in places that look like windows.', 'Sometimes the music ends so that a story can begin.'],
  oracleClosers: ['Do not believe me yet: watch.', 'Keep that clue and you will never run out of road.', 'If you say it too loud, it might disappear.', 'Ask me again when the stars move.', 'Even a giant can be wrong about eternity.', 'Some answers only work when they are whispered.', 'Patience is also a way of travelling.', 'Some doors only open on the way back.', 'The universe looks empty because it keeps its surprises at the edges.', 'The truth waits, but it never knocks twice.']
};
