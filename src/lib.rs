use anchor_lang::prelude::*;

declare_id!("BSYeAoLnJbymFg1NYcDzF8Gepst6hfYynKvDhjJ1mDPJ");

const MAX_NAME: usize = 32;
const MAX_BIO: usize = 256;

#[program]
pub mod profile_pda {
    use super::*;

    pub fn create_profile(
        ctx: Context<CreateProfile>,
        name: String,
        bio: String,
    ) -> Result<()> {
        validate_profile(&name, &bio)?;

        let profile = &mut ctx.accounts.profile;
        profile.owner = ctx.accounts.owner.key();
        profile.name = name;
        profile.bio = bio;

        msg!("Profile created");
        msg!("Name: {}", profile.name);
        Ok(())
    }

    pub fn update_profile(
        ctx: Context<UpdateProfile>,
        name: String,
        bio: String,
    ) -> Result<()> {
        validate_profile(&name, &bio)?;

        let profile = &mut ctx.accounts.profile;
        profile.name = name;
        profile.bio = bio;

        msg!("Profile updated");
        msg!("Name: {}", profile.name);
        Ok(())
    }
}

fn validate_profile(name: &str, bio: &str) -> Result<()> {
    require!(
        !name.trim().is_empty(),
        ProfileError::EmptyName
    );
    require!(
        name.as_bytes().len() <= MAX_NAME,
        ProfileError::NameTooLong
    );
    require!(
        bio.as_bytes().len() <= MAX_BIO,
        ProfileError::BioTooLong
    );
    Ok(())
}

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 4 + MAX_NAME + 4 + MAX_BIO,
        seeds = [b"profile", owner.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(
        mut,
        seeds = [b"profile", profile.owner.as_ref()],
        bump,
        has_one = owner @ ProfileError::Unauthorized
    )]
    pub profile: Account<'info, Profile>,

    pub owner: Signer<'info>,
}

#[account]
pub struct Profile {
    pub owner: Pubkey,
    pub name: String,
    pub bio: String,
}

#[error_code]
pub enum ProfileError {
    #[msg("Name must not be empty")]
    EmptyName,

    #[msg("Name exceeds 32 bytes")]
    NameTooLong,

    #[msg("Bio exceeds 256 bytes")]
    BioTooLong,

    #[msg("Only the profile owner can update it")]
    Unauthorized,
}
