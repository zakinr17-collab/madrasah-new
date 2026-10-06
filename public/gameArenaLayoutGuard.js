(function () {
  function injectStyles() {
    if (document.getElementById('arena-layout-guard-styles')) return;
    const style = document.createElement('style');
    style.id = 'arena-layout-guard-styles';
    style.textContent = `
      .arena-ref-shell {
        max-height: calc(100vh - 28px) !important;
        overflow: auto !important;
        border-radius: 22px !important;
      }
      .arena-ref-wrap {
        display: grid !important;
        grid-template-rows: auto auto !important;
        height: auto !important;
        overflow: visible !important;
      }
      .arena-ref-wrap > [data-arena-stage] {
        position: relative !important;
        height: clamp(460px, 56vw, 600px) !important;
        min-height: 460px !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      [data-arena-stage].arena2-stage > .arena2-bg,
      [data-arena-stage].arena2-stage > .arena2-vignette {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
      [data-arena-stage].arena2-stage > .arena2-bg {
        display: block !important;
        object-fit: cover !important;
        object-position: center !important;
        z-index: 1 !important;
      }
      [data-arena-stage].arena2-stage > .arena2-vignette {
        z-index: 2 !important;
        pointer-events: none !important;
        background:
          linear-gradient(180deg, rgba(2,6,23,.18), transparent 32%, transparent 68%, rgba(2,6,23,.42)),
          radial-gradient(circle at 50% 50%, transparent 48%, rgba(2,6,23,.18) 100%) !important;
      }
      [data-arena-stage].arena2-stage > .arena2-hud {
        position: absolute !important;
        left: 14px !important;
        right: 14px !important;
        top: 12px !important;
        width: auto !important;
        z-index: 52 !important;
      }
      [data-arena-stage].arena2-stage > .arena2-playfield {
        position: absolute !important;
        left: 3.2% !important;
        right: 3.2% !important;
        top: 18% !important;
        bottom: 5.5% !important;
        width: auto !important;
        height: auto !important;
        z-index: 34 !important;
      }
      [data-arena-stage].arena2-stage > .arena2-caption {
        bottom: 8px !important;
        z-index: 56 !important;
      }
      [data-arena-stage="laser_duel"] .arena2-fighter .arena-hd-character {
        width: clamp(78px, 10vw, 112px) !important;
      }
      [data-arena-stage="tug_war"] .arena2-team-member .arena-hd-character {
        width: clamp(43px, 5.5vw, 62px) !important;
      }
      [data-arena-stage="base_battle"] .arena2-base-team .arena-hd-character {
        width: clamp(38px, 4.7vw, 54px) !important;
      }
      [data-arena-stage="battle_royale"] .arena2-br-player .arena-hd-character {
        width: clamp(42px, 5.2vw, 60px) !important;
      }
      [data-arena-stage="quiz_race"] .arena-hd-kart {
        width: clamp(68px, 8vw, 92px) !important;
      }
      [data-arena-stage="battle_royale"] .arena2-br-field {
        border: 0 !important;
        background: transparent !important;
      }
      [data-arena-stage="tug_war"] .arena2-team {
        flex-wrap: nowrap !important;
        gap: 1px !important;
        padding-bottom: 4% !important;
      }
      [data-arena-stage="tug_war"] .arena2-team-member {
        width: auto !important;
        flex: 1 1 0 !important;
        max-width: 64px !important;
      }
      [data-arena-stage="tug_war"].arena2-stage > .arena2-playfield {
        top: 36% !important;
        bottom: 3% !important;
      }
      [data-arena-stage="tug_war"] .arena2-tug-field {
        position: relative !important;
        display: grid !important;
        grid-template-columns: minmax(0,1fr) minmax(0,1fr) !important;
        gap: 10px !important;
      }
      [data-arena-stage="tug_war"] .arena-team-a { grid-column: 1 !important; padding-right: 6% !important; }
      [data-arena-stage="tug_war"] .arena-team-b { grid-column: 2 !important; padding-left: 6% !important; }
      [data-arena-stage="tug_war"] .arena2-tug-center {
        position: absolute !important;
        left: 23% !important;
        right: 23% !important;
        top: 0 !important;
        bottom: 0 !important;
        z-index: 2 !important;
        pointer-events: none !important;
      }
      [data-arena-stage="tug_war"] .arena2-team {
        position: relative !important;
        z-index: 5 !important;
      }
      [data-arena-stage="laser_duel"].arena2-stage > .arena2-playfield {
        top: 31% !important;
        bottom: 4% !important;
      }
      [data-arena-stage="base_battle"].arena2-stage > .arena2-playfield {
        top: 25% !important;
        bottom: 3% !important;
      }
      [data-arena-stage="base_battle"] .arena-castle-img {
        display: none !important;
      }
      [data-arena-stage="base_battle"] .arena2-base-visual {
        height: 78px !important;
      }
      [data-arena-stage="base_battle"] .arena-shield-fx {
        width: 105px !important;
        height: 105px !important;
        top: 62% !important;
      }
      [data-arena-stage="battle_royale"].arena2-stage > .arena2-playfield {
        top: 14% !important;
        bottom: 2.5% !important;
        left: 2.5% !important;
        right: 2.5% !important;
      }
      [data-arena-stage="quiz_race"].arena2-stage > .arena2-playfield {
        top: 31% !important;
        bottom: 3% !important;
      }
      [data-arena-stage="quiz_race"] .arena2-race-track {
        background: rgba(2,6,23,.08) !important;
        border-radius: 18px !important;
        padding-left: 4px !important;
      }
      [data-arena-stage="quiz_race"] .arena2-race-lane {
        border-bottom: 1px dashed rgba(255,255,255,.5) !important;
      }
      .arena-ref-bottom {
        padding: 12px !important;
        gap: 10px !important;
      }
      @media (max-width: 720px) {
        .arena-ref-shell { max-height: calc(100vh - 16px) !important; }
        .arena-ref-wrap > [data-arena-stage] {
          height: 390px !important;
          min-height: 390px !important;
        }
        [data-arena-stage].arena2-stage > .arena2-hud {
          left: 8px !important;
          right: 8px !important;
          top: 8px !important;
        }
        [data-arena-stage].arena2-stage > .arena2-playfield {
          left: 2% !important;
          right: 2% !important;
          top: 20% !important;
          bottom: 4% !important;
        }
        [data-arena-stage="tug_war"] .arena2-tug-field {
          grid-template-columns: minmax(0,1fr) minmax(68px,.55fr) minmax(0,1fr) !important;
          gap: 3px !important;
        }
        [data-arena-stage="tug_war"] .arena2-team-member .arena2-name { display:none !important; }
        [data-arena-stage="laser_duel"] .arena2-laser-field {
          grid-template-columns: 70px minmax(86px,1fr) 70px !important;
          gap: 4px !important;
        }
        [data-arena-stage="base_battle"] .arena2-base-field {
          grid-template-columns: minmax(0,1fr) 48px minmax(0,1fr) !important;
          gap: 4px !important;
        }
        [data-arena-stage="base_battle"] .arena2-base-visual { height:112px !important; }
        [data-arena-stage="base_battle"] .arena-castle-img { width:min(112px,82%) !important;height:112px !important; }
        [data-arena-stage="quiz_race"] .arena2-race-field {
          grid-template-columns: 88px minmax(0,1fr) !important;
          gap: 6px !important;
        }
        [data-arena-stage="laser_duel"] .arena2-fighter .arena-hd-character { width: 72px !important; }
        [data-arena-stage="tug_war"] .arena2-team-member .arena-hd-character { width: 43px !important; }
        [data-arena-stage="base_battle"] .arena2-base-team .arena-hd-character { width: 36px !important; }
        [data-arena-stage="battle_royale"] .arena2-br-player .arena-hd-character { width: 40px !important; }
        [data-arena-stage="quiz_race"] .arena-hd-kart { width: 66px !important; }
        [data-arena-stage="tug_war"].arena2-stage > .arena2-playfield {
          top: 37% !important;
          bottom: 2% !important;
        }
        [data-arena-stage="tug_war"] .arena2-tug-field {
          grid-template-columns: minmax(0,1fr) minmax(0,1fr) !important;
          gap: 3px !important;
        }
        [data-arena-stage="laser_duel"].arena2-stage > .arena2-playfield {
          top: 32% !important;
        }
        [data-arena-stage="base_battle"].arena2-stage > .arena2-playfield {
          top: 27% !important;
        }
        [data-arena-stage="battle_royale"].arena2-stage > .arena2-playfield {
          top: 16% !important;
          left: 1.5% !important;
          right: 1.5% !important;
        }
        [data-arena-stage="quiz_race"].arena2-stage > .arena2-playfield {
          top: 33% !important;
        }
        .arena2-hud-reference {
          grid-template-columns: minmax(0,1fr) 120px minmax(0,1fr) !important;
          gap: 4px !important;
        }
        .arena2-hud-card { padding: 6px 7px !important; border-width: 2px !important; border-radius: 12px !important; }
        .arena2-hud-card-label { font-size: 7px !important; }
        .arena2-hud-card-meter { height: 6px !important; margin-top: 4px !important; }
        .arena2-hud-reference .arena-score-pill { min-width: 120px !important; padding: 5px 7px !important; border-width: 2px !important; border-radius: 12px !important; }
        .arena2-hud-reference .arena2-title { font-size: 10px !important; }
        .arena2-hud-reference .arena2-status { font-size: 6px !important; }
        .arena2-fighter-card { max-width: 104px !important; padding: 4px !important; }
        .arena2-name, .arena2-stat { font-size: 7px !important; }
      }
      @media (max-width: 430px) {
        .arena-ref-wrap > [data-arena-stage] {
          height: 360px !important;
          min-height: 360px !important;
        }
        [data-arena-stage].arena2-stage > .arena2-playfield {
          top: 21% !important;
          bottom: 3% !important;
        }
        [data-arena-stage="laser_duel"] .arena2-fighter .arena-hd-character { width: 62px !important; }
        [data-arena-stage="tug_war"] .arena2-team-member .arena-hd-character { width: 38px !important; }
        [data-arena-stage="base_battle"] .arena2-base-team .arena-hd-character { width: 32px !important; }
        [data-arena-stage="battle_royale"] .arena2-br-player .arena-hd-character { width: 35px !important; }
        [data-arena-stage="quiz_race"] .arena-hd-kart { width: 58px !important; }
      }
      /* arena-final-reference-polish */
      [data-arena-stage="laser_duel"] .arena2-playfield {
        top:20%!important;
        bottom:7%!important;
      }
      [data-arena-stage="laser_duel"] .arena2-laser-field {
        grid-template-columns:minmax(150px,.75fr) minmax(260px,2.1fr) minmax(150px,.75fr)!important;
        gap:18px!important;
      }
      [data-arena-stage="laser_duel"] .arena2-fighter { padding-bottom:2%!important; }
      [data-arena-stage="laser_duel"] .arena2-laser-track { top:57%!important; height:14px!important; }

      [data-arena-stage="tug_war"] .arena2-playfield { top:21%!important; bottom:6%!important; }
      [data-arena-stage="tug_war"] .arena2-tug-field {
        grid-template-columns:minmax(230px,1fr) minmax(220px,.82fr) minmax(230px,1fr)!important;
        gap:18px!important;
      }
      [data-arena-stage="tug_war"] .arena2-team { padding-bottom:10%!important; }
      [data-arena-stage="tug_war"] .arena-tug-rope { top:65%!important; height:13px!important; }
      [data-arena-stage="tug_war"] .arena-tug-flag { top:44%!important; }

      [data-arena-stage="battle_royale"] .arena2-playfield { top:18%!important; bottom:6%!important; }
      [data-arena-stage="battle_royale"] .arena2-br-field {
        border:0!important;
        border-radius:28px!important;
        box-shadow:inset 0 0 0 2px rgba(255,255,255,.08),0 18px 35px rgba(2,6,23,.24)!important;
      }
      [data-arena-stage="battle_royale"] .arena2-br-player { width:clamp(52px,6.8vw,82px)!important; }
      [data-arena-stage="battle_royale"] .arena2-br-copy {
        background:rgba(8,24,38,.72)!important;
        border-color:rgba(255,255,255,.18)!important;
      }

      [data-arena-stage="base_battle"] .arena2-playfield { top:19%!important; bottom:6%!important; }
      [data-arena-stage="base_battle"] .arena2-base-field {
        grid-template-columns:minmax(220px,1fr) minmax(100px,.42fr) minmax(220px,1fr)!important;
        gap:18px!important;
      }
      [data-arena-stage="base_battle"] .arena2-base-visual { height:180px!important; }
      [data-arena-stage="base_battle"] .arena2-base-live-core {
        width:92px!important;
        height:68px!important;
        bottom:2px!important;
      }
      [data-arena-stage="base_battle"] .arena2-base-card {
        background:rgba(7,24,42,.82)!important;
      }

      [data-arena-stage="quiz_race"] .arena2-playfield { top:20%!important; bottom:7%!important; }
      [data-arena-stage="quiz_race"] .arena2-race-field {
        grid-template-columns:minmax(160px,.44fr) minmax(0,1.56fr)!important;
        gap:16px!important;
      }
      [data-arena-stage="quiz_race"] .arena2-rank {
        background:rgba(9,27,48,.84)!important;
        border:2px solid rgba(255,255,255,.16)!important;
      }

      @media (max-width:720px) {
        [data-arena-stage="laser_duel"] .arena2-playfield { top:22%!important; bottom:4%!important; }
        [data-arena-stage="laser_duel"] .arena2-laser-field {
          grid-template-columns:70px minmax(92px,1fr) 70px!important;
          gap:4px!important;
        }
        [data-arena-stage="laser_duel"] .arena2-laser-track { top:58%!important; height:9px!important; }

        [data-arena-stage="tug_war"] .arena2-tug-field {
          grid-template-columns:minmax(0,1fr) minmax(72px,.38fr) minmax(0,1fr)!important;
          gap:3px!important;
        }
        [data-arena-stage="tug_war"] .arena2-team { padding-bottom:7%!important; }
        [data-arena-stage="tug_war"] .arena2-team-member { max-width:48px!important; }
        [data-arena-stage="tug_war"] .arena-tug-rope { top:63%!important; }
        [data-arena-stage="tug_war"] .arena-tug-flag { top:44%!important; }

        [data-arena-stage="battle_royale"] .arena2-playfield { top:21%!important; bottom:4%!important; }
        [data-arena-stage="battle_royale"] .arena2-br-player { width:44px!important; }
        [data-arena-stage="battle_royale"] .arena2-br-copy { display:none!important; }

        [data-arena-stage="base_battle"] .arena2-base-field {
          grid-template-columns:minmax(0,1fr) 48px minmax(0,1fr)!important;
          gap:4px!important;
        }
        [data-arena-stage="base_battle"] .arena2-base-visual { height:120px!important; }
        [data-arena-stage="base_battle"] .arena2-base-live-core { width:62px!important; height:48px!important; }

        [data-arena-stage="quiz_race"] .arena2-race-field {
          grid-template-columns:82px minmax(0,1fr)!important;
          gap:5px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyles, { once: true });
  } else {
    injectStyles();
  }
})();
